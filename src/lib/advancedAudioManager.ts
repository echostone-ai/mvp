// Advanced Audio Manager - HeyGen-style seamless voice interaction
export class AdvancedAudioManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private recognition: any = null;
  private isInitialized = false;
  private isListening = false;
  private isSpeaking = false;
  private voiceActivityThreshold = 0.01;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private voiceActivityCallback: ((isActive: boolean) => void) | null = null;
  private transcriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private lastSpeechTime = 0;
  private speechBuffer: Float32Array = new Float32Array(1024);
  private backgroundNoiseLevel = 0;
  private calibrationSamples = 0;
  private maxCalibrationSamples = 100;

  constructor() {
    this.bindMethods();
  }

  private bindMethods() {
    this.processAudio = this.processAudio.bind(this);
    this.handleSpeechResult = this.handleSpeechResult.bind(this);
    this.handleSpeechEnd = this.handleSpeechEnd.bind(this);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🎤 Initializing advanced audio manager...');

      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Get microphone with advanced constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      // Create audio analysis chain
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.microphone.connect(this.analyser);

      // Initialize speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      // Set up event handlers
      this.recognition.onstart = () => {
        console.log('✅ Speech recognition started');
      };
      
      this.recognition.onresult = this.handleSpeechResult;
      this.recognition.onend = this.handleSpeechEnd;
      this.recognition.onerror = (event: any) => {
        console.warn('🎤 Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          console.error('❌ Microphone permission denied');
          this.isListening = false;
        } else if (event.error === 'no-speech') {
          console.log('🎤 No speech detected - continuing to listen');
          // Don't restart automatically for no-speech, let it continue
        } else if (event.error !== 'aborted' && this.isListening) {
          console.log('🎤 Restarting recognition after error:', event.error);
          setTimeout(() => {
            if (this.isListening && !this.isSpeaking) {
              this.recognition?.start();
            }
          }, 1000);
        }
      };

      this.isInitialized = true;
      console.log('✅ Advanced audio manager initialized');

      // Start background noise calibration
      this.calibrateBackgroundNoise();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio manager:', error);
      return false;
    }
  }

  private calibrateBackgroundNoise() {
    if (!this.analyser || this.calibrationSamples >= this.maxCalibrationSamples) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    this.backgroundNoiseLevel = (this.backgroundNoiseLevel * this.calibrationSamples + average) / (this.calibrationSamples + 1);
    this.calibrationSamples++;

    // Adjust threshold based on background noise
    this.voiceActivityThreshold = Math.max(0.01, this.backgroundNoiseLevel / 255 * 0.1);

    if (this.calibrationSamples < this.maxCalibrationSamples) {
      setTimeout(() => this.calibrateBackgroundNoise(), 100);
    } else {
      console.log(`🎤 Background noise calibrated: ${this.backgroundNoiseLevel.toFixed(2)}, threshold: ${this.voiceActivityThreshold.toFixed(4)}`);
    }
  }

  private processAudio() {
    if (!this.analyser || !this.isListening || this.isSpeaking) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate voice activity
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    
    // Detect voice activity above background noise
    const isVoiceActive = normalizedLevel > (this.backgroundNoiseLevel / 255 + this.voiceActivityThreshold);

    if (isVoiceActive) {
      this.lastSpeechTime = Date.now();
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    } else {
      // Check for silence period
      const silenceDuration = Date.now() - this.lastSpeechTime;
      if (silenceDuration > 1500 && !this.silenceTimeout) { // 1.5 seconds of silence
        this.silenceTimeout = setTimeout(() => {
          if (this.voiceActivityCallback) {
            this.voiceActivityCallback(false);
          }
        }, 500);
      }
    }

    // Continue processing
    if (this.isListening) {
      requestAnimationFrame(this.processAudio);
    }
  }

  private handleSpeechResult(event: any) {
    if (!this.isListening || this.isSpeaking) return;

    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript.trim();
    const confidence = result[0].confidence || 0;

    console.log('🎤 Speech result:', { transcript, confidence, isFinal: result.isFinal });

    // Filter out low confidence and short utterances
    if (transcript.length < 2 || confidence < 0.5) {
      console.log('🎤 Filtered low confidence/short:', { transcript, confidence });
      return;
    }

    // Check if this might be avatar echo
    if (this.isLikelyAvatarEcho(transcript, confidence)) {
      console.log('🎤 Filtered avatar echo:', transcript);
      return;
    }

    if (this.transcriptCallback) {
      console.log('🎤 Calling transcript callback:', { transcript, isFinal: result.isFinal });
      this.transcriptCallback(transcript, result.isFinal);
    }

    // Don't stop listening here - let the parent component handle it
    // The component will stop listening when it processes the final transcript
  }

  private handleSpeechEnd() {
    if (this.isListening && !this.isSpeaking) {
      // Restart recognition if we're still supposed to be listening
      setTimeout(() => {
        if (this.isListening && !this.isSpeaking) {
          this.recognition?.start();
        }
      }, 100);
    }
  }

  private isLikelyAvatarEcho(transcript: string, confidence: number): boolean {
    const lowerTranscript = transcript.toLowerCase();
    
    // Common avatar response patterns - expanded list with recent phrases
    const avatarPatterns = [
      'hello', 'hi there', 'how can i help', 'that\'s interesting', 
      'tell me more', 'i understand', 'that sounds', 'i see',
      'jonathan', 'braden', 'sofia', 'bulgaria', 'espresso', 'childhood',
      'adventure', 'curiosity', 'exploring', 'great outdoors', 'history books',
      'perfect recipe', 'curious soul', 'thrill of discovering', 'diving into',
      'soaking up', 'vibes', 'plotting', 'dreaming about', 'cobblestone streets',
      'adventurous and curious', 'exploring new places', 'unforgettable memories',
      'tapestry of our adventures', 'hiking vitosha', 'beautiful tapestry',
      'piecing together', 'each moment', 'krissy', 'absolute gem'
    ];

    const hasAvatarPattern = avatarPatterns.some(pattern => 
      lowerTranscript.includes(pattern)
    );

    // More aggressive echo detection - if it contains avatar phrases, likely echo
    if (hasAvatarPattern) {
      console.log('🎤 Detected likely avatar echo (pattern match):', transcript);
      return true;
    }

    // Also check if the transcript is very similar to recent avatar responses
    // This is a simple heuristic - in a real system you'd store recent responses
    const recentAvatarPhrases = [
      'blend of adventure', 'curiosity exploring', 'history books',
      'perfect recipe', 'curious soul', 'discovering new trails'
    ];

    const hasRecentPhrase = recentAvatarPhrases.some(phrase => 
      lowerTranscript.includes(phrase)
    );

    if (hasRecentPhrase) {
      console.log('🎤 Detected likely avatar echo (recent phrase):', transcript);
      return true;
    }

    return false;
  }

  async startListening(): Promise<boolean> {
    if (!this.isInitialized) {
      console.log('🎤 Cannot start - not initialized');
      return false;
    }
    
    if (this.isListening) {
      console.log('🎤 Already listening');
      return true;
    }
    
    if (this.isSpeaking) {
      console.log('🎤 Cannot start - avatar is speaking');
      return false;
    }

    try {
      console.log('🎤 Starting advanced listening...');
      this.isListening = true;
      this.lastSpeechTime = Date.now();
      
      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        console.log('🎤 Resuming audio context...');
        await this.audioContext.resume();
      }

      // Start speech recognition
      console.log('🎤 Starting speech recognition...');
      this.recognition?.start();
      
      // Start audio processing
      this.processAudio();

      console.log('✅ Advanced listening started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.isListening = false;
      return false;
    }
  }

  stopListening() {
    if (!this.isListening) return;

    console.log('🔇 Stopping advanced listening...');
    this.isListening = false;
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    try {
      this.recognition?.stop();
    } catch (error) {
      console.warn('Warning stopping recognition:', error);
    }
  }

  setAvatarSpeaking(speaking: boolean) {
    console.log(`🗣️ Avatar speaking state: ${speaking}`);
    this.isSpeaking = speaking;
    
    if (speaking) {
      // Immediately stop listening when avatar starts speaking
      console.log('🔇 Avatar started speaking - stopping all audio processing');
      this.stopListening();
    } else {
      // Wait longer after avatar stops speaking before resuming
      console.log('🔇 Avatar stopped speaking - waiting before resuming listening');
      setTimeout(() => {
        if (!this.isSpeaking && this.voiceActivityCallback) {
          console.log('🎤 Resuming listening after avatar speech');
          this.startListening();
        }
      }, 1500); // Increased delay for better audio separation
    }
  }

  onVoiceActivity(callback: (isActive: boolean) => void) {
    this.voiceActivityCallback = callback;
  }

  onTranscript(callback: (transcript: string, isFinal: boolean) => void) {
    this.transcriptCallback = callback;
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255;
  }

  destroy() {
    console.log('🗑️ Destroying advanced audio manager...');
    
    this.stopListening();
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.isInitialized = false;
    this.voiceActivityCallback = null;
    this.transcriptCallback = null;
  }
}