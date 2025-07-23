import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    
    if (stream && isRecording) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const canvasCtx = canvas.getContext('2d');
        if (canvasCtx) {
          const draw = () => {
            if (!isRecording) return;
            
            animationRef.current = requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            canvasCtx.fillStyle = 'rgba(20, 15, 40, 0.6)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
              barHeight = dataArray[i] / 2;
              
              const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
              gradient.addColorStop(0, '#9147ff');
              gradient.addColorStop(1, '#6a00ff');
              
              canvasCtx.fillStyle = gradient;
              canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              
              x += barWidth + 1;
            }
          };
          
          draw();
        }
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [stream, isRecording]);
  
  return (
    <div className="audio-visualizer-container">
      <canvas 
        ref={canvasRef} 
        className="audio-visualizer-canvas"
        width={300}
        height={100}
      />
    </div>
  );
};

export default AudioVisualizer;