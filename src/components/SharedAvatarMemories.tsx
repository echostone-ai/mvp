'use client';

import React, { useState, useEffect, useRef } from 'react';
// CSS is imported in the layout file

interface Memory {
  id: string;
  userId: string;
  avatarId: string;
  shareToken?: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}

interface SharedAvatarMemoriesProps {
  userId: string;
  avatarId: string;
  shareToken?: string;
  avatarName: string;
}

export default function SharedAvatarMemories({ userId, avatarId, shareToken, avatarName }: SharedAvatarMemoriesProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Fetch memories
  useEffect(() => {
    async function fetchMemories() {
      try {
        const response = await fetch('/api/private-memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'list',
            userId,
            avatarId,
            shareToken
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch memories');
        }
        
        const data = await response.json();
        setMemories(data.memories || []);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load memories');
        setLoading(false);
      }
    }

    fetchMemories();
  }, [userId, avatarId, shareToken]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMemoryContent.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          userId,
          avatarId,
          shareToken,
          content: newMemoryContent.trim(),
          source: 'manual'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create memory');
      }
      
      const data = await response.json();
      
      // Add new memory to the list
      setMemories([data.memory, ...memories]);
      setNewMemoryContent('');
      setIsAddingMemory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create memory');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Start recording audio for voice memory
  const startRecording = async () => {
    try {
      setRecordingError(null);
      
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available');
        setRecordingError('Your browser does not support audio recording. Please try a different browser like Chrome or Firefox.');
        return;
      }
      
      // Request microphone access
      console.log('Requesting microphone access...');
      console.log('Browser info:', navigator.userAgent);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('Microphone access granted');
      mediaStreamRef.current = stream;
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported in this browser');
      }
      
      // Find a supported MIME type
      const mimeTypes = [
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav'
      ];
      
      let mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      console.log('Using MIME type:', mimeType || 'default');
      
      // Create MediaRecorder
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        console.log('Data available event:', e.data.size, 'bytes');
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        setIsRecording(false);
        
        // Clean up the media stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
        
        if (chunks.length === 0) {
          console.warn('No audio data recorded');
          setRecordingError('No audio was recorded. Please try again.');
          return;
        }
        
        // Create audio blob
        const mimeType = chunks[0].type || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        
        if (blob.size === 0) {
          console.warn('Empty audio blob');
          setRecordingError('Recording failed. Please try again.');
          return;
        }
        
        console.log('Recording complete, blob size:', blob.size, 'type:', blob.type);
        
        // Create form data for API request
        const formData = new FormData();
        formData.append('audio', blob, `memory.${mimeType.split('/')[1]}`);
        formData.append('userId', userId);
        formData.append('avatarId', avatarId);
        if (shareToken) {
          formData.append('shareToken', shareToken);
        }
        
        setIsSubmitting(true);
        
        try {
          // Send to memory-voice API
          const response = await fetch('/api/memory-voice', {
            method: 'POST',
            body: formData
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to process voice memory');
          }
          
          console.log('Voice memory created:', data);
          
          // Add new memory to the list if it was created
          if (data.memory && data.memory.id) {
            setMemories([data.memory, ...memories]);
          } else if (data.transcript) {
            // Create a local memory object if the API didn't return one
            const localMemory: Memory = {
              id: `local-${Date.now()}`,
              userId,
              avatarId,
              shareToken,
              content: data.transcript,
              source: 'voice',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isPrivate: true
            };
            setMemories([localMemory, ...memories]);
          }
        } catch (err: any) {
          console.error('Voice memory error:', err);
          setRecordingError(err.message || 'Failed to create voice memory');
        } finally {
          setIsSubmitting(false);
        }
      };
      
      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setIsRecording(false);
        setRecordingError('Recording error occurred');
      };
      
      // Start recording
      recorder.start();
      setIsRecording(true);
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 10000);
      
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
      
      if (err.name === 'NotAllowedError') {
        setRecordingError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setRecordingError(err.message || 'Failed to start recording');
      }
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Clean up the media stream immediately
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          memoryId,
          userId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete memory');
      }
      
      // Remove memory from the list
      setMemories(memories.filter(memory => memory.id !== memoryId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete memory');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading memories...</p>
      </div>
    );
  }

  return (
    <div className="memories-container">
      <div className="memories-header">
        <h2 className="memories-title">Your Memories with {avatarName}</h2>
        <div className="memory-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsAddingMemory(true)}
            disabled={isRecording}
          >
            ✏️ Type Memory
          </button>
          {!isRecording ? (
            <button
              className="btn btn-secondary"
              onClick={startRecording}
              disabled={isSubmitting}
            >
              🎤 Voice Memory
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={stopRecording}
            >
              ⏹️ Stop Recording
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {recordingError && <div className="alert alert-error">{recordingError}</div>}
      
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span>Recording... (speak clearly, will auto-stop after 10 seconds)</span>
        </div>
      )}

      {isAddingMemory && (
        <form onSubmit={handleAddMemory} className="memory-form">
          <div className="form-group">
            <label htmlFor="memory-content" className="form-label">Memory Content</label>
            <textarea
              id="memory-content"
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              className="form-textarea"
              placeholder="Enter something you want to remember about this avatar..."
              rows={3}
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddingMemory(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Memory'}
            </button>
          </div>
        </form>
      )}

      {memories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <h3 className="empty-state-title">No Memories Yet</h3>
          <p className="empty-state-message">
            As you chat with {avatarName}, important information will be saved as memories.
            You can also manually add memories that you want to remember.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setIsAddingMemory(true)}
          >
            Add Your First Memory
          </button>
        </div>
      ) : (
        <div className="memories-list">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-card">
              <div className="memory-content">
                {memory.content}
              </div>
              <div className="memory-footer">
                <div className="memory-meta">
                  <span className="memory-source">
                    {memory.source === 'conversation' ? 'From conversation' : 'Manually added'}
                  </span>
                  <span className="memory-date">
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}