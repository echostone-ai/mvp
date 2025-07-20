'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';

interface AddMemoryFormProps {
  hubId: string;
  onSuccess?: () => void;
}

type ContentType = 'text' | 'image' | 'audio';

export default function AddMemoryForm({ hubId, onSuccess }: AddMemoryFormProps) {
  const [contentType, setContentType] = useState<ContentType>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContentTypeChange = (type: ContentType) => {
    setContentType(type);
    setError(null);
    
    // Clear previous file and preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const fileType = contentType === 'image' 
      ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      : ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    
    if (!fileType.includes(selectedFile.type)) {
      setError(`Invalid file type. Please upload a ${contentType} file.`);
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const uploadFile = async (file: File): Promise<string> => {
    // Create a form data object
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hubId', hubId);
    
    // Upload to your storage service
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to upload file');
    }
    
    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    // Validate input
    if (contentType === 'text' && !textContent.trim()) {
      setError('Please enter some text.');
      return;
    }
    
    if ((contentType === 'image' || contentType === 'audio') && !file) {
      setError(`Please select a ${contentType} file.`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let content = textContent;
      let mediaUrl = '';
      
      // If it's a file-based memory, upload the file first
      if (file) {
        mediaUrl = await uploadFile(file);
      }
      
      // Create the memory
      const response = await fetch(`/api/hubs/${hubId}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentType === 'text' ? textContent : mediaUrl,
          contentType,
          mediaUrl: contentType !== 'text' ? mediaUrl : undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create memory');
      }
      
      // Reset form
      setTextContent('');
      setFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSuccess(true);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-memory-form p-4 border rounded">
      <h3 className="text-xl font-bold mb-4">Add a Memory</h3>
      
      {error && (
        <div className="error-message mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-message mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Memory added successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="content-type-selector mb-4">
          <label className="block text-sm font-medium mb-2">Memory Type</label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => handleContentTypeChange('text')}
              className={`flex-1 py-2 px-3 rounded ${
                contentType === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => handleContentTypeChange('image')}
              className={`flex-1 py-2 px-3 rounded ${
                contentType === 'image'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Image
            </button>
            <button
              type="button"
              onClick={() => handleContentTypeChange('audio')}
              className={`flex-1 py-2 px-3 rounded ${
                contentType === 'audio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Audio
            </button>
          </div>
        </div>
        
        {contentType === 'text' ? (
          <div className="text-input mb-4">
            <label htmlFor="textContent" className="block text-sm font-medium mb-2">
              Your Memory
            </label>
            <textarea
              id="textContent"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={5}
              className="w-full p-2 border rounded"
              placeholder="Share a memory or story..."
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <div className="file-input mb-4">
            <label className="block text-sm font-medium mb-2">
              Upload {contentType === 'image' ? 'an Image' : 'an Audio Recording'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={contentType === 'image' ? 'image/*' : 'audio/*'}
              onChange={handleFileChange}
              className="w-full p-2 border rounded"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Max file size: 10MB. Supported formats: {contentType === 'image' 
                ? 'JPEG, PNG, GIF, WebP' 
                : 'MP3, WAV, MP4, WebM, OGG'}
            </p>
          </div>
        )}
        
        {/* Preview section */}
        {previewUrl && contentType === 'image' && (
          <div className="preview-section mb-4">
            <h4 className="text-sm font-medium mb-2">Preview:</h4>
            <div className="image-preview">
              <Image 
                src={previewUrl} 
                alt="Preview" 
                width={300} 
                height={200} 
                className="rounded"
                objectFit="cover"
              />
            </div>
          </div>
        )}
        
        {previewUrl && contentType === 'audio' && (
          <div className="preview-section mb-4">
            <h4 className="text-sm font-medium mb-2">Preview:</h4>
            <audio controls src={previewUrl} className="w-full" />
          </div>
        )}
        
        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isSubmitting ? 'Adding Memory...' : 'Add Memory'}
          </button>
        </div>
      </form>
    </div>
  );
}