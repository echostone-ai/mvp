'use client';

import React, { useState, useRef } from 'react';
import { validateVoiceQuality, testEnhancedVsBaseline, type QualityValidationResult } from '@/lib/enhancedVoiceConfig';

interface VoiceQualityValidatorProps {
  onValidationComplete?: (result: QualityValidationResult) => void;
  className?: string;
}

export default function VoiceQualityValidator({ onValidationComplete, className = '' }: VoiceQualityValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<QualityValidationResult | null>(null);
  const [abTestResult, setAbTestResult] = useState<any>(null);
  const [testText, setTestText] = useState('Hello, this is a test of the enhanced voice quality system.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileValidation = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsValidating(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await validateVoiceQuality(arrayBuffer);
      setValidationResult(result);
      onValidationComplete?.(result);
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        isValid: false,
        metrics: {
          snr: 0,
          peakLevel: 0,
          rmsLevel: 0,
          dynamicRange: 0,
          format: 'unknown',
          sampleRate: 0,
          bitrate: 0
        },
        issues: ['Failed to validate audio file'],
        recommendations: ['Please try a different audio file']
      });
    } finally {
      setIsValidating(false);
    }
  };

  const runABTest = async () => {
    setIsValidating(true);
    try {
      // Mock A/B test - in real implementation this would generate and compare audio
      const result = await testEnhancedVsBaseline(
        testText,
        'CO6pxVrMZfyL61ZIglyr', // Default voice ID
        { output_format: 'mp3_22050_32', optimize_streaming_latency: 2 }
      );
      setAbTestResult(result);
    } catch (error) {
      console.error('A/B test failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const getQualityColor = (isValid: boolean) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  };

  const getPassRateColor = (passRate: number) => {
    if (passRate >= 80) return 'text-green-600';
    if (passRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Voice Quality Validator</h3>
      
      {/* File Upload Validation */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Audio Quality Analysis</h4>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileValidation}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={isValidating}
        />
        
        {validationResult && (
          <div className="mt-4 p-4 border rounded-lg">
            <div className={`font-medium ${getQualityColor(validationResult.isValid)}`}>
              {validationResult.isValid ? '✅ Quality Passed' : '❌ Quality Issues Detected'}
            </div>
            
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>SNR:</strong> {validationResult.metrics.snr.toFixed(1)}dB
              </div>
              <div>
                <strong>Peak Level:</strong> {validationResult.metrics.peakLevel.toFixed(1)}dB
              </div>
              <div>
                <strong>Sample Rate:</strong> {validationResult.metrics.sampleRate}Hz
              </div>
              <div>
                <strong>Dynamic Range:</strong> {validationResult.metrics.dynamicRange.toFixed(1)}dB
              </div>
            </div>
            
            {validationResult.issues.length > 0 && (
              <div className="mt-3">
                <strong className="text-red-600">Issues:</strong>
                <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                  {validationResult.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.recommendations.length > 0 && (
              <div className="mt-3">
                <strong className="text-blue-600">Recommendations:</strong>
                <ul className="list-disc list-inside text-sm text-blue-600 mt-1">
                  {validationResult.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* A/B Test Panel */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">A/B Test: Enhanced vs Standard</h4>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Test Text:</label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
            rows={2}
            disabled={isValidating}
          />
        </div>
        
        <button
          onClick={runABTest}
          disabled={isValidating || !testText.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isValidating ? 'Running Test...' : 'Run A/B Test'}
        </button>
        
        {abTestResult && (
          <div className="mt-4 p-4 border rounded-lg">
            <div className={`font-medium ${getPassRateColor(abTestResult.passRate)}`}>
              Pass Rate: {abTestResult.passRate}% {abTestResult.passRate >= 80 ? '✅' : '❌'}
            </div>
            
            <div className="mt-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Enhanced Quality:</strong> {abTestResult.metrics.enhancedQuality}/10
                </div>
                <div>
                  <strong>Baseline Quality:</strong> {abTestResult.metrics.baselineQuality}/10
                </div>
                <div>
                  <strong>Latency Improvement:</strong> {abTestResult.metrics.latencyImprovement}s
                </div>
                <div>
                  <strong>Consistency Score:</strong> {(abTestResult.metrics.consistencyScore * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="mt-3">
                <span className={`font-medium ${abTestResult.enhancedBetter ? 'text-green-600' : 'text-red-600'}`}>
                  {abTestResult.enhancedBetter ? '✅ Enhanced configuration is better' : '❌ Enhanced configuration needs improvement'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quality Standards */}
      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
        <strong>Quality Standards:</strong>
        <ul className="mt-1 space-y-1">
          <li>• SNR: ≥20dB for good quality</li>
          <li>• Sample Rate: ≥44.1kHz for premium quality</li>
          <li>• A/B Test Pass Rate: ≥80% required</li>
          <li>• Peak Level: &lt;-1dB to avoid clipping</li>
        </ul>
      </div>
    </div>
  );
}