// Simplified streaming logic for testing
export const simplifiedStreamingLogic = `
      let fullResponse = '';
      let processedSentences = 0;

      // Stream the response
      for await (const char of streamChatResponse(text, newHistory, profileData, {
        userId,
        avatarId,
        visitorName,
        isSharedAvatar,
        shareToken,
        voiceId
      })) {
        fullResponse += char;
        setStreamingText(fullResponse);

        // Simple sentence detection - check every 20 characters for efficiency
        if (fullResponse.length % 20 === 0 || char.match(/[.!?]/)) {
          const sentences = fullResponse.split(/(?<=[.!?])\\s+/);
          
          // Send any new complete sentences
          while (processedSentences < sentences.length - 1) {
            const sentence = sentences[processedSentences].trim();
            if (sentence.length > 5) {
              console.log('[ChatInterface] Sending sentence to audio:', sentence.substring(0, 50) + '...');
              if (streamingAudioRef.current) {
                streamingAudioRef.current.addSentence(sentence);
              }
            }
            processedSentences++;
          }
        }
      }

      // Handle the final sentence
      const sentences = fullResponse.split(/(?<=[.!?])\\s+/);
      if (processedSentences < sentences.length) {
        const lastSentence = sentences[sentences.length - 1]?.trim();
        if (lastSentence && lastSentence.length > 5) {
          console.log('[ChatInterface] Sending final sentence to audio:', lastSentence.substring(0, 50) + '...');
          if (streamingAudioRef.current) {
            streamingAudioRef.current.addSentence(lastSentence);
          }
        }
      }
`;