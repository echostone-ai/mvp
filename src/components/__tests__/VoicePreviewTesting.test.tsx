import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VoicePreviewTesting from '../VoicePreviewTesting';

// Mock the enhanced voice service
jest.mock('../../lib/enhancedVoiceService', () => ({
  enhancedVoiceService: {
    generateSpeech: jest.fn().mockResolvedValue({
      success: true,
      audio_data: new ArrayBuffer(1024),
      generation_time: 1000
    }),
    generateEmotionalPreviews: jest.fn().mockResolvedValue({
      happy: { success: true, audio_data: new ArrayBuffer(1024) },
      sad: { success: true, audio_data: new ArrayBuffer(1024) },
      excited: { success: true, audio_data: new ArrayBuffer(1024) },
      calm: { success: true, audio_data: new ArrayBuffer(1024) },
      serious: { success: true, audio_data: new ArrayBuffer(1024) },
      playful: { success: true, audio_data: new ArrayBuffer(1024) }
    })
  }
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-audio-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Audio constructor
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(),
  pause: jest.fn(),
  onended: null,
  onerror: null,
  currentTime: 0
}));

describe('VoicePreviewTesting', () => {
  const defaultProps = {
    voiceId: 'test-voice-id',
    userName: 'TestUser'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the voice preview testing interface', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    expect(screen.getByText('Voice Preview & Testing')).toBeInTheDocument();
    expect(screen.getByText('Test your voice with different emotions, scenarios, and parameter adjustments')).toBeInTheDocument();
  });

  it('displays all three tabs', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    expect(screen.getByText('Emotional Contexts')).toBeInTheDocument();
    expect(screen.getByText('Scenarios')).toBeInTheDocument();
    expect(screen.getByText('Voice Parameters')).toBeInTheDocument();
  });

  it('shows emotional previews by default including all emotions', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    expect(screen.getByText('Happy')).toBeInTheDocument();
    expect(screen.getByText('Sad')).toBeInTheDocument();
    expect(screen.getByText('Excited')).toBeInTheDocument();
    expect(screen.getByText('Calm')).toBeInTheDocument();
    expect(screen.getByText('Serious')).toBeInTheDocument();
    expect(screen.getByText('Playful')).toBeInTheDocument();
    expect(screen.getByText('Angry')).toBeInTheDocument();
    expect(screen.getByText('Surprised')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
  });

  it('can switch to scenarios tab', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Scenarios'));
    
    expect(screen.getByText('Contextual Scenarios')).toBeInTheDocument();
    expect(screen.getByText('Custom Text Testing')).toBeInTheDocument();
  });

  it('can switch to parameters tab', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    expect(screen.getByText('Voice Parameter Adjustment')).toBeInTheDocument();
    expect(screen.getByText('Parameter Guide')).toBeInTheDocument();
    expect(screen.getByText('Stability')).toBeInTheDocument();
    expect(screen.getByText('Similarity Boost')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
    expect(screen.getByText('Speaker Boost')).toBeInTheDocument();
  });

  it('displays contextual scenarios with filtering', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Scenarios'));
    
    expect(screen.getByText('Friendly Greeting')).toBeInTheDocument();
    expect(screen.getByText('Professional Presentation')).toBeInTheDocument();
    expect(screen.getByText('Storytelling')).toBeInTheDocument();
    
    // Test filtering
    const filterSelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(filterSelect, { target: { value: 'professional' } });
    
    expect(screen.getByText('Professional Presentation')).toBeInTheDocument();
    expect(screen.getByText('Clear Instructions')).toBeInTheDocument();
  });

  it('allows voice parameter adjustment', () => {
    const onParametersChange = jest.fn();
    render(<VoicePreviewTesting {...defaultProps} onParametersChange={onParametersChange} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    const stabilitySlider = screen.getByDisplayValue('0.75');
    fireEvent.change(stabilitySlider, { target: { value: '0.8' } });
    
    expect(onParametersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stability: 0.8
      })
    );
  });

  it('can save voice settings', () => {
    const onSettingsSaved = jest.fn();
    render(<VoicePreviewTesting {...defaultProps} onSettingsSaved={onSettingsSaved} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    const saveButton = screen.getByText('💾 Save Optimized Settings');
    fireEvent.click(saveButton);
    
    expect(onSettingsSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        stability: expect.any(Number),
        similarity_boost: expect.any(Number),
        style: expect.any(Number),
        use_speaker_boost: expect.any(Boolean)
      })
    );
  });

  it('handles custom text input', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Scenarios'));
    
    const textArea = screen.getByPlaceholderText('Enter your own text to test how it sounds with your voice...');
    fireEvent.change(textArea, { target: { value: 'Test custom text' } });
    
    expect(textArea).toHaveValue('Test custom text');
    
    const testButton = screen.getByText('▶️ Test');
    expect(testButton).not.toBeDisabled();
  });

  it('generates emotional previews when requested', async () => {
    const { enhancedVoiceService } = require('../../lib/enhancedVoiceService');
    
    render(<VoicePreviewTesting {...defaultProps} />);
    
    const generateAllButton = screen.getByText('🎭 Generate All Previews');
    fireEvent.click(generateAllButton);
    
    await waitFor(() => {
      expect(enhancedVoiceService.generateEmotionalPreviews).toHaveBeenCalledWith(
        'test-voice-id',
        expect.stringContaining('TestUser voice expressing different emotions')
      );
    });
  });

  it('uses initial settings when provided', () => {
    const initialSettings = {
      stability: 0.9,
      similarity_boost: 0.7,
      style: 0.3,
      use_speaker_boost: false,
      optimize_streaming_latency: 0.4,
      model_id: 'eleven_multilingual_v2' as const
    };
    
    render(<VoicePreviewTesting {...defaultProps} initialSettings={initialSettings} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    expect(screen.getByDisplayValue('0.90')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.70')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.30')).toBeInTheDocument();
  });

  it('enables parameter comparison functionality', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    const enableComparisonButton = screen.getByText('🔄 Enable Comparison');
    fireEvent.click(enableComparisonButton);
    
    expect(screen.getByText('Parameter Comparison')).toBeInTheDocument();
    expect(screen.getByText('Compare your current settings with a previous version to hear the difference.')).toBeInTheDocument();
    expect(screen.getByText('▶️ Test Current')).toBeInTheDocument();
    expect(screen.getByText('▶️ Test Comparison')).toBeInTheDocument();
  });

  it('can reset parameters to defaults', () => {
    const onParametersChange = jest.fn();
    render(<VoicePreviewTesting {...defaultProps} onParametersChange={onParametersChange} />);
    
    fireEvent.click(screen.getByText('Voice Parameters'));
    
    // Change a parameter first
    const stabilitySlider = screen.getByDisplayValue('0.75');
    fireEvent.change(stabilitySlider, { target: { value: '0.9' } });
    
    // Reset to defaults
    const resetButton = screen.getByText('↺ Reset to Defaults');
    fireEvent.click(resetButton);
    
    expect(onParametersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stability: 0.75,
        similarity_boost: 0.85,
        style: 0.2,
        use_speaker_boost: true
      })
    );
  });

  it('displays comprehensive scenario categories', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Scenarios'));
    
    // Check for various scenario categories
    expect(screen.getByText('Friendly Greeting')).toBeInTheDocument();
    expect(screen.getByText('Storytelling')).toBeInTheDocument();
    expect(screen.getByText('Professional Presentation')).toBeInTheDocument();
    expect(screen.getByText('Empathetic Response')).toBeInTheDocument();
    expect(screen.getByText('Exciting News')).toBeInTheDocument();
    expect(screen.getByText('Bedtime Story')).toBeInTheDocument();
    expect(screen.getByText('Phone Message')).toBeInTheDocument();
  });

  it('filters scenarios by category correctly', () => {
    render(<VoicePreviewTesting {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Scenarios'));
    
    // Filter by expressive category
    const filterSelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(filterSelect, { target: { value: 'expressive' } });
    
    expect(screen.getByText('Empathetic Response')).toBeInTheDocument();
    expect(screen.getByText('Exciting News')).toBeInTheDocument();
    expect(screen.getByText('Celebration')).toBeInTheDocument();
    
    // Professional scenarios should not be visible
    expect(screen.queryByText('Professional Presentation')).not.toBeInTheDocument();
  });

  it('generates individual emotional previews', async () => {
    const { enhancedVoiceService } = require('../../lib/enhancedVoiceService');
    
    render(<VoicePreviewTesting {...defaultProps} />);
    
    // Find and click a generate button for a specific emotion
    const generateButtons = screen.getAllByText('🔄 Generate');
    fireEvent.click(generateButtons[0]); // Click first generate button (Happy)
    
    await waitFor(() => {
      expect(enhancedVoiceService.generateSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('TestUser voice expressing happy'),
          voice_id: 'test-voice-id',
          emotional_context: 'happy'
        })
      );
    });
  });
});