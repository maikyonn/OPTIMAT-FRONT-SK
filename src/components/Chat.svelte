<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { PROVIDERS_API_BASE, CHAT_API_URL } from '../config';
    import { fade, fly, slide } from 'svelte/transition';
    import { serviceZoneManager } from '../lib/serviceZoneManager.js';
    const PROVIDER_API_BASE = PROVIDERS_API_BASE;
    const CHAT_API_BASE = CHAT_API_URL;
    const dispatch = createEventDispatcher();
    
    // Typewriter effect component
    function typewriterAction(node, { text, maxDuration = 2000, messageId, onComplete = null }) {
        let i = 0;
        let currentText = '';
        let timeoutId;
        let isDestroyed = false;
        
        // Calculate simple speed to fit within maxDuration
        const availableTime = maxDuration - 100; // subtract initial delay
        const speed = Math.max(5, availableTime / text.length); // minimum 5ms per character
        
        // Add typing indicator to the set
        typingMessages.add(messageId);
        typingMessages = typingMessages; // Trigger reactivity
        
        function type() {
            if (isDestroyed || i >= text.length) {
                // Remove typing indicator
                typingMessages.delete(messageId);
                typingMessages = typingMessages; // Trigger reactivity
                if (onComplete) onComplete();
                return;
            }
            
            currentText += text.charAt(i);
            node.textContent = currentText;
            i++;
            
            timeoutId = setTimeout(type, speed);
        }
        
        // Start typing with a small delay to allow the message to appear first
        timeoutId = setTimeout(type, 100);
        
        return {
            destroy() {
                isDestroyed = true;
                if (timeoutId) clearTimeout(timeoutId);
                typingMessages.delete(messageId);
                typingMessages = typingMessages; // Trigger reactivity
            }
        };
    }
  
    let messages = [
      {
        role: 'ai',
        content: "Hello! I'm here to help you find paratransit providers. How can I assist you today?",
        id: 'initial-greeting'
      }
    ];
    
    let userInput = "I'm at Hanover Walnut Creek apartments, and trying to go to the Target in Walnut Creek? Can you help me find providers?";
    let loading = false; // For message sending
    let initializing = true; // For initial conversation setup
    let error = null;
    let serverOnline = false;
    let conversationId = null;
    
    // Save as example functionality
    let savingAsExample = false;
    let showExampleForm = false;
    let exampleForm = {
      title: '',
      description: '',
      tags: ''
    };
    
    // Example viewing functionality
    let isViewingExample = false;
    let currentExample = null;
    let isLoadingExample = false;
    let examplePlaybackPaused = false;
    let currentExampleIndex = 0; // Track current message index in example
    let totalExampleStates = 0; // Total number of states in current example
    
    // Typewriter effect state
    let typingMessages = new Set(); // Track which messages are currently typing

    // Debug mode for logging
    const DEBUG_MODE = true;

    // Enhanced attachment handling
    let messageAttachments = new Map(); // Map message IDs to their attachments
    
    // Service zone state management
    let visibleProviderZones = new Set(); // Track which provider zones are visible
    let loadingProviderZones = new Set(); // Track which provider zones are loading

    // Debug logging function
    function debugLogChatResponse(fullResponse, timestamp = new Date().toISOString()) {
        if (!DEBUG_MODE) return;
        
        console.group(`🔍 CHAT RESPONSE DEBUG - ${timestamp}`);
        console.log('📦 Full Response Object:', fullResponse);
        
        if (fullResponse.messages) {
            console.log('💬 Messages:', fullResponse.messages);
            console.log('📊 Message Count:', fullResponse.messages.length);
        }
        
        if (fullResponse.attachments) {
            console.log('📎 Attachments:', fullResponse.attachments);
            console.log('📊 Attachment Count:', fullResponse.attachments.length);
            
            fullResponse.attachments.forEach((attachment, index) => {
                console.log(`📌 Attachment ${index + 1}:`, {
                    type: attachment.type,
                    dataKeys: Object.keys(attachment.data || {}),
                    metadata: attachment.metadata
                });
            });
        } else {
            console.log('📎 No attachments in response');
        }
        
        console.log('🗃️ Current Message Attachments Map:');
        console.log('Message Attachments Map Size:', messageAttachments.size);
        console.log('All Message IDs:', messages.map(m => m.id));
        console.log('Messages with Attachments:', Array.from(messageAttachments.keys()));
        console.groupEnd();
        
        console.groupEnd();
    }

    function debugLogFullChatHistory() {
        if (!DEBUG_MODE) return;
        
        console.group('📚 COMPLETE CHAT HISTORY');
        
        // Log all messages with their attachments
        const chatHistory = messages.map(msg => ({
            message: msg,
            attachments: messageAttachments.get(msg.id) || [],
            hasAttachments: messageAttachments.has(msg.id)
        }));
        
        console.log('Complete Chat Log:', chatHistory);
        
        // Log attachment summary
        const totalAttachments = Array.from(messageAttachments.values())
            .reduce((total, attachments) => total + attachments.length, 0);
        
        console.log('📊 Summary:', {
            totalMessages: messages.length,
            messagesWithAttachments: messageAttachments.size,
            totalAttachments: totalAttachments,
            attachmentTypes: Array.from(messageAttachments.values())
                .flat()
                .map(att => att.type)
                .filter((type, index, arr) => arr.indexOf(type) === index)
        });
        
        console.groupEnd();
    }

    // Attachment helper functions
    function hasAttachments(messageId) {
        return messageAttachments.has(messageId) && messageAttachments.get(messageId).length > 0;
    }

    function getAttachmentCount(messageId) {
        const attachments = messageAttachments.get(messageId);
        return attachments ? attachments.length : 0;
    }

    function getAttachmentTypes(messageId) {
        const attachments = messageAttachments.get(messageId);
        return attachments ? attachments.map(att => att.type) : [];
    }

    function getProviderSummary(messageId) {
        const attachments = messageAttachments.get(messageId);
        if (!attachments) return null;
        
        const providerAttachment = attachments.find(att => att.type === 'provider_search');
        if (!providerAttachment || !providerAttachment.data) return null;
        
        const data = providerAttachment.data;
        const providers = data.data || [];
        const publicTransit = data.public_transit;
        
        return {
            count: providers.length,
            sourceAddress: data.source_address,
            destinationAddress: data.destination_address,
            providers: providers.slice(0, 3), // Show first 3
            moreCount: Math.max(0, providers.length - 3),
            hasPublicTransit: publicTransit && publicTransit.routes && publicTransit.routes.length > 0,
            allProviders: providers // Keep reference to all providers
        };
    }

    // Service zone management functions
    async function toggleProviderServiceZone(providerId, providerName, provider) {
        const isVisible = visibleProviderZones.has(providerId);
        
        if (isVisible) {
            // Hide the zone
            serviceZoneManager.removeServiceZonesByProvider(providerId);
            visibleProviderZones.delete(providerId);
            visibleProviderZones = new Set(visibleProviderZones); // Trigger reactivity
        } else {
            // Show the zone
            loadingProviderZones.add(providerId);
            loadingProviderZones = new Set(loadingProviderZones); // Trigger reactivity
            
            try {
                // Use the service zone data if available from provider
                if (provider.service_zone) {
                    const zoneData = {
                        type: 'provider',
                        geoJson: typeof provider.service_zone === 'string' 
                            ? JSON.parse(provider.service_zone) 
                            : provider.service_zone,
                        label: providerName,
                        description: `${providerName} service area`,
                        metadata: {
                            providerId: providerId,
                            provider: provider
                        }
                    };
                    
                    const zoneId = serviceZoneManager.addServiceZone(zoneData, false);
                    if (zoneId) {
                        visibleProviderZones.add(providerId);
                        // Focus on this specific provider's zone
                        serviceZoneManager.focusOnServiceZone(zoneId);
                    }
                } else {
                    // Fallback: try to fetch from API if no service zone data
                    const response = await fetch(`${PROVIDER_API_BASE}/providers/${providerId}/service-zone`);
                    
                    if (response.ok) {
                        const zoneData = await response.json();
                        if (zoneData.has_service_zone && zoneData.raw_data) {
                            const serviceZoneData = {
                                type: 'provider',
                                geoJson: zoneData.raw_data,
                                label: providerName,
                                description: `${providerName} service area`,
                                metadata: {
                                    providerId: providerId,
                                    provider: provider
                                }
                            };
                            
                            const zoneId = serviceZoneManager.addServiceZone(serviceZoneData, false);
                            if (zoneId) {
                                visibleProviderZones.add(providerId);
                                // Focus on this specific provider's zone
                                serviceZoneManager.focusOnServiceZone(zoneId);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading service zone:', error);
            } finally {
                loadingProviderZones.delete(providerId);
                loadingProviderZones = new Set(loadingProviderZones); // Trigger reactivity
            }
        }
        
        visibleProviderZones = new Set(visibleProviderZones); // Trigger reactivity
    }

    function isProviderZoneVisible(providerId) {
        return visibleProviderZones.has(providerId);
    }

    function isProviderZoneLoading(providerId) {
        return loadingProviderZones.has(providerId);
    }

    function getAddressSummary(messageId) {
        const attachments = messageAttachments.get(messageId);
        if (!attachments) return null;
        
        const addressAttachment = attachments.find(att => att.type === 'address_search');
        if (!addressAttachment || !addressAttachment.data) return null;
        
        const places = addressAttachment.data.places || [];
        if (places.length === 0) return null;
        
        return {
            address: places[0].formattedAddress,
            name: places[0].displayName?.text
        };
    }

    function handleMessageClick(messageId) {
        const attachments = messageAttachments.get(messageId);
        if (!attachments || attachments.length === 0) return;
        
        // Check if this message is recent for filtering purposes
        const messageIndex = messages.findIndex(m => m.id === messageId);
        const isRecentMessage = messageIndex >= messages.length - 3;
        
        if (!isViewingExample) {
            // Handle provider attachments - always allow (original behavior)
            const providerAttachment = attachments.find(att => att.type === 'provider_search');
            if (providerAttachment && providerAttachment.data) {
                // Clear existing service zones when showing new provider results
                serviceZoneManager.clearAllServiceZones();
                visibleProviderZones.clear();
                loadingProviderZones.clear();
                
                // Process provider data and add to service zone manager
                const providerData = providerAttachment.data;
                if (providerData.data && providerData.data.length > 0) {
                    // Add all provider service zones to the manager (but don't focus yet)
                    serviceZoneManager.addProviderServiceZones(providerData.data, false);
                }
                
                // Emit provider data for the popup
                dispatch('providersFound', providerAttachment.data);
            }
            
            // Handle address attachments - only for recent messages to show location on map
            const addressAttachment = attachments.find(att => att.type === 'address_search');
            if (addressAttachment && addressAttachment.data && isRecentMessage) {
                const places = addressAttachment.data.places || [];
                if (places.length > 0) {
                    const firstPlace = places[0];
                    const address = firstPlace.formattedAddress;
                    
                    // Emit address found event to show on map
                    dispatch('addressFound', {
                        address: address,
                        messageRole: 'attachment_click',
                        placeName: firstPlace.displayName?.text || null
                    });
                }
            }
        }
    }

    async function checkServerHealth() {
      try {
        const response = await fetch(`${CHAT_API_BASE}/health`);
        serverOnline = response.ok;
        if (!serverOnline) {
          error = "Chat server is currently offline.";
        }
      } catch (e) {
        serverOnline = false;
        error = "Failed to connect to the chat server.";
      }
    }

    async function initializeNewConversation() {
      initializing = true;
      error = null;
      try {
        const response = await fetch(`${CHAT_API_BASE}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: "New Chat via Frontend" }) // Backend expects a title
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to initialize conversation." }));
          throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const newConversation = await response.json();
        if (newConversation && newConversation.id) {
          conversationId = newConversation.id;
          console.log("Conversation initialized with ID:", conversationId);
          return true;
        } else {
          throw new Error("Failed to retrieve conversation ID from server.");
        }
      } catch (e) {
        error = `Error initializing conversation: ${e.message}`;
        console.error(error);
        return false;
      } finally {
        initializing = false;
      }
    }
  
    onMount(() => {
      checkServerHealth().then(() => {
        if (serverOnline) {
          initializeNewConversation();
        }
      });
      const interval = setInterval(checkServerHealth, 30000);
      
      // Add keyboard shortcut for debug logging
      const handleKeydown = (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          debugLogFullChatHistory();
        }
      };
      
      window.addEventListener('keydown', handleKeydown);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('keydown', handleKeydown);
      };
    });
  
    async function handleSubmit() {
      if (!userInput.trim() || !serverOnline || initializing || !conversationId) {
        if (!conversationId && !initializing) {
            error = "Conversation not initialized. Please wait or refresh.";
        }
        return;
      }
  
      loading = true;
      error = null;
  
      const newMessage = {
        role: 'human',
        content: userInput,
        id: `human-${Date.now()}`
      };
  
      messages = [...messages, newMessage];
      userInput = ''; // Clear input immediately
      scrollToBottom();
  
      try {
                const response = await fetch(`${CHAT_API_BASE}/enhanced`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_message: newMessage,
            conversation_id: conversationId 
          })
        });
  
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Failed to send message." }));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }
  
        const fullResponse = await response.json();
        
        // Debug logging
        debugLogChatResponse(fullResponse);
        
        if (fullResponse.messages) {
          const validMessages = fullResponse.messages.filter(m => 
            (m.role === 'ai' || m.role === 'human') && 
            typeof m.content === 'string' && 
            m.content.trim() !== ''
          ).map((m, i) => ({
            ...m,
            id: m.id || `response-${Date.now()}-${i}`
          }));
          
          // Handle attachments - always process for the latest message
          if (validMessages.length > 0) {
            const latestMessageId = validMessages[validMessages.length - 1].id;
            if (fullResponse.attachments && fullResponse.attachments.length > 0) {
              // Set attachments for the new message
              messageAttachments.set(latestMessageId, fullResponse.attachments);
              
              // Auto-click "View Details" for provider search attachments
              const hasProviderAttachment = fullResponse.attachments.some(att => att.type === 'provider_search');
              if (hasProviderAttachment) {
                // Use setTimeout to ensure the DOM is updated before triggering the click
                setTimeout(() => {
                  handleMessageClick(latestMessageId);
                }, 100);
              }
            } else {
              // Ensure no attachments are associated with this message
              messageAttachments.delete(latestMessageId);
            }
            messageAttachments = messageAttachments; // Trigger reactivity
          }
          
          messages = [...messages, ...validMessages];
          scrollToBottom();
        }
      } catch (e) {
        error = e.message;
        // Optionally, add the user's message back to input if sending failed
        // userInput = newMessage.content; 
      } finally {
        loading = false;
      }
    }

    
    // Export function to check server status
    export function getServerStatus() {
      return serverOnline;
    }
    
    // Export functions to control example playback
    export function pauseExamplePlayback() {
      if (isViewingExample && isLoadingExample) {
        examplePlaybackPaused = true;
        console.log('Example playback paused');
      }
    }
    
    export function resumeExamplePlayback() {
      if (isViewingExample && examplePlaybackPaused) {
        examplePlaybackPaused = false;
        console.log('Example playback resumed');
        // If we were in the middle of loading, continue from where we left off
        if (currentExampleIndex < totalExampleStates) {
          continueExamplePlayback();
        }
      }
    }
    
    async function continueExamplePlayback() {
      // Load next message from current index, processing system messages but not displaying them
      const conversationStates = currentExample?._conversationStates;
      if (!conversationStates || currentExampleIndex >= conversationStates.length) {
        isLoadingExample = false;
        return;
      }
      
      // Check if paused or not viewing example
      if (examplePlaybackPaused || !isViewingExample) {
        return;
      }
      
      // Process system messages and empty AI messages automatically without displaying them
      while (currentExampleIndex < conversationStates.length) {
        const stateSnapshot = conversationStates[currentExampleIndex];
        const message = stateSnapshot.message;
        
        // Skip system messages and empty AI messages
        if (message.role === 'system' || 
            (message.role === 'ai' && (!message.content || message.content.trim() === ''))) {
          // Process message state but don't display the message
          await applyConversationState(stateSnapshot.state);
          currentExampleIndex++;
          continue; // Continue to next message automatically
        } else {
          // This is a user message or AI message with content - display it and stop
          const messageWithId = {
            ...message,
            id: message.id || `example-${currentExampleIndex}-${Date.now()}`
          };
          messages = [...messages, messageWithId];
          
          // Apply the conversation state
          await applyConversationState(stateSnapshot.state);
          
          scrollToBottom();
          currentExampleIndex++;
          break; // Stop after displaying one user/AI message
        }
      }
      
      // Check if this was the last message
      if (currentExampleIndex >= conversationStates.length) {
        isLoadingExample = false;
        console.log('Finished loading example conversation with states:', currentExample);
      }
    }
    
    // Example viewing functionality with state reconstruction
    export async function loadExampleWithStates(conversationStates, example) {
      try {
        isViewingExample = true;
        isLoadingExample = true;
        examplePlaybackPaused = false;
        currentExample = { ...example, _conversationStates: conversationStates };
        currentExampleIndex = 0;
        totalExampleStates = conversationStates.length;
        
        // Reset conversation state and clear all messages
        conversationId = null;
        error = null;
        messages = []; // Clear all messages first
        
        // Load the first message
        await continueExamplePlayback();
        
        // Set loading to false after first message loads
        isLoadingExample = false;
        
      } catch (error) {
        console.error('Error loading example conversation with states:', error);
        isLoadingExample = false;
        throw error;
      }
    }
    
    async function applyConversationState(state) {
      try {
        console.log('Applying conversation state:', state);
        
        // Handle providers state
        if (state.providers) {
          console.log('Applying provider state:', state.providers);
          console.log('Dispatching providersFound event...');
          dispatch('providersFound', state.providers);
          console.log('Provider event dispatched successfully');
          
          // For examples, we want providers to show immediately
          if (isViewingExample) {
            console.log('Example mode: Ensuring provider popup shows');
          }
        } else {
          console.log('No providers in state');
        }
        
        // Skip map updates during example playback to prevent map resetting
        if (!isViewingExample) {
          // Handle map geocoding if needed
          if (state.mapState?.pendingGeocode) {
            console.log('Applying map state:', state.mapState.pendingGeocode);
            // Trigger address geocoding for map updates
            dispatch('addressFound', { 
              address: state.mapState.pendingGeocode.origin, 
              messageRole: 'system' 
            });
            
            // Small delay before destination
            setTimeout(() => {
              dispatch('addressFound', { 
                address: state.mapState.pendingGeocode.destination, 
                messageRole: 'system' 
              });
            }, 500);
          }
          
          // Handle individual addresses
          if (state.addresses && state.addresses.length > 0) {
            console.log('Found addresses in state:', state.addresses);
            // Could emit address events for additional map updates if needed
          }
        }
        
      } catch (error) {
        console.error('Error applying conversation state:', error);
      }
    }
    
    export function startNewConversation() {
      isViewingExample = false;
      isLoadingExample = false;
      examplePlaybackPaused = false;
      currentExample = null;
      currentExampleIndex = 0;
      totalExampleStates = 0;
      conversationId = null;
      messages = [{
        role: 'ai',
        content: "Hello! I'm here to help you find paratransit providers. How can I assist you today?",
        id: 'new-conversation-greeting'
      }];
      
      // Clear service zones when starting new conversation
      serviceZoneManager.clearAllServiceZones();
      visibleProviderZones.clear();
      loadingProviderZones.clear();
      
      // Emit event to notify parent components
      dispatch('newConversationStarted');
      
      // Initialize a new conversation
      if (serverOnline) {
        initializeNewConversation();
      }
    }
    
    function scrollToBottom(smooth = true) {
      // Scroll chat window to bottom
      setTimeout(() => {
        const chatWindow = document.querySelector('.chat-messages');
        if (chatWindow) {
          if (smooth) {
            chatWindow.scrollTo({
              top: chatWindow.scrollHeight,
              behavior: 'smooth'
            });
          } else {
            chatWindow.scrollTop = chatWindow.scrollHeight;
          }
        }
      }, 100);
    }

    function openExampleForm() {
      if (!conversationId) {
        error = "No conversation to save. Please start chatting first.";
        return;
      }
      showExampleForm = true;
      exampleForm = {
        title: '',
        description: '',
        tags: ''
      };
    }

    function closeExampleForm() {
      showExampleForm = false;
      exampleForm = {
        title: '',
        description: '',
        tags: ''
      };
    }

    async function saveAsExample() {
      if (!conversationId || savingAsExample) {
        return;
      }

      savingAsExample = true;
      error = null;

      try {
        const tags = exampleForm.tags 
          ? exampleForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : [];

                const response = await fetch(`${CHAT_API_BASE}/conversations/${conversationId}/add-to-examples`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            title: exampleForm.title || null,
            description: exampleForm.description || null,
            tags: tags,
            is_active: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to save example." }));
          throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const exampleData = await response.json();
        console.log('Chat example saved:', exampleData);
        
        // Show success message
        const successMessage = {
          role: 'system',
          content: `✅ This conversation has been saved as an example${exampleForm.title ? ': "' + exampleForm.title + '"' : ''}!`,
          id: `success-${Date.now()}`
        };
        messages = [...messages, successMessage];
        scrollToBottom();
        
        closeExampleForm();
        
      } catch (e) {
        error = `Error saving example: ${e.message}`;
        console.error('Error saving chat example:', e);
      } finally {
        savingAsExample = false;
      }
    }

</script> 
  <div class="flex flex-col h-full">
    {#if !serverOnline}
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <!-- You can add a warning icon here if desired -->
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              Chat is currently unavailable. The server appears to be offline.
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Example viewing banner or Save as Example Button -->
    {#if isViewingExample}
      <div class="px-4 pt-2 pb-0 flex justify-between items-center bg-blue-50 mx-4 rounded-lg p-2">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          <span class="text-sm text-blue-700 font-medium">Viewing Example</span>
        </div>
        <button
          on:click={startNewConversation}
          class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Start New Chat
        </button>
      </div>
    {:else if conversationId && messages.length > 1 && serverOnline}
      <div class="px-4 pt-2 pb-0 flex justify-end">
        <button
          on:click={openExampleForm}
          disabled={savingAsExample}
          class="text-sm px-3 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-all duration-200 flex items-center space-x-1"
          title="Save this conversation as an example for others"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
          <span>Save as Example</span>
        </button>
      </div>
    {/if}
  
    <!-- Chat messages -->
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-0 space-y-4 chat-messages scroll-smooth">
      {#each messages.filter(m => (m.role === 'ai' || m.role === 'human') && typeof m.content === 'string' && m.content.trim() !== '') as message, index (message.id || `${message.role}-${index}-${message.content.substring(0, 20)}`)}
        <div 
          class="flex flex-col {message.role === 'human' ? 'items-end' : 'items-start'}"
          in:fly={{ 
            x: message.role === 'human' ? 30 : -30, 
            y: 10,
            duration: 500,
            delay: 0
          }}
        >
          <div class="max-w-[80%] rounded-lg p-3 {
            message.role === 'human'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }">
            {#if message.role === 'human' && !isViewingExample}
              <!-- User messages in live chat: no typing animation -->
              <p class="whitespace-pre-wrap">{message.content}</p>
            {:else}
              <!-- AI messages and all messages in examples: typing animation -->
              <p 
                class="whitespace-pre-wrap inline"
                use:typewriterAction={{ 
                  text: message.content, 
                  maxDuration: 2000, 
                  messageId: message.id 
                }}
              ></p>
              {#if typingMessages.has(message.id)}
                <span class="typing-cursor">|</span>
              {/if}
            {/if}
          </div>
          <span class="text-xs text-gray-500 mt-1 opacity-60">
            {message.role}
          </span>
        </div>
        
        <!-- Separate attachment display (appears as independent message) -->
        {#if hasAttachments(message.id)}
          {@const isRecentMessage = !isViewingExample && messages.findIndex(m => m.id === message.id) >= messages.length - 3}
          {@const hasProviderAttachment = getProviderSummary(message.id) !== null}
          {@const hasAddressAttachment = getAddressSummary(message.id) !== null}
          {@const shouldBeClickable = hasProviderAttachment || (hasAddressAttachment && isRecentMessage)}
          <div class="flex flex-col items-start mt-2"
               in:fly={{ x: -30, y: 10, duration: 500, delay: 200 }}>
            
            <!-- Attachment display with clickable action text -->
            <div class="max-w-[85%] rounded-lg shadow-md {shouldBeClickable ? '' : 'opacity-75'}">
            
            {#if getProviderSummary(message.id)}
                {@const summary = getProviderSummary(message.id)}
                <div class="bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 border-2 border-green-200 rounded-lg p-4">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="bg-green-100 p-2 rounded-full">
                      <svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div class="text-base font-bold text-green-800">
                        Found {summary.count} Transportation {summary.count === 1 ? 'Provider' : 'Providers'}
                      </div>
                      <div class="text-sm text-green-600">Ready for booking</div>
                    </div>
                  </div>
                  
                  <div class="bg-white bg-opacity-70 rounded-md p-3 mb-3">
                    <div class="text-sm text-gray-700">
                      <div class="flex items-center gap-2 mb-1">
                        <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />
                        </svg>
                        <span class="font-medium">From:</span> {summary.sourceAddress}
                      </div>
                      <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" transform="rotate(180 10 10)" />
                        </svg>
                        <span class="font-medium">To:</span> {summary.destinationAddress}
                      </div>
                    </div>
                  </div>
                  
                  <div class="space-y-2 mb-3">
                    {#each summary.providers as provider, index (provider.provider_id || index)}
                      <div class="flex items-center gap-3 text-sm bg-white bg-opacity-50 rounded-md p-2">
                        <div class="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <div class="flex-1">
                          <span class="font-medium text-gray-800">{provider.provider_name}</span>
                          <span class="text-gray-500 ml-2">({provider.provider_type})</span>
                        </div>
                        <!-- Service Zone Button for Individual Providers -->
                          <button
                            class="text-xs px-2 py-1 rounded-md font-medium transition-colors {
                              isProviderZoneVisible(provider.provider_id || provider.id)
                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }"
                            on:click|stopPropagation={() => toggleProviderServiceZone(
                              provider.provider_id || provider.id, 
                              provider.provider_name, 
                              provider
                            )}
                            disabled={isProviderZoneLoading(provider.provider_id || provider.id)}
                            title="{isProviderZoneVisible(provider.provider_id || provider.id) ? 'Hide' : 'Show'} service zone"
                          >
                            {#if isProviderZoneLoading(provider.provider_id || provider.id)}
                              <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                            {:else if isProviderZoneVisible(provider.provider_id || provider.id)}
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                              </svg>
                            {:else}
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                              </svg>
                            {/if}
                          </button>
                      </div>
                    {/each}
                    {#if summary.moreCount > 0}
                      <div class="text-sm font-medium text-blue-600 bg-blue-50 rounded-md p-2 text-center">
                        ...and {summary.moreCount} more provider{summary.moreCount === 1 ? '' : 's'}
                      </div>
                    {/if}
                  </div>
                  
                  {#if summary.hasPublicTransit}
                    <div class="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-md">
                      <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                      </svg>
                      <span class="text-sm text-blue-700 font-medium">Public transit routes available</span>
                    </div>
                  {/if}
                  
                  <div class="flex items-center justify-between pt-3 border-t border-green-200">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span class="text-sm text-gray-600">Book 1-3 days in advance</span>
                    </div>
                    <button 
                      class="flex items-center gap-1 text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors cursor-pointer"
                      on:click={() => handleMessageClick(message.id)}
                      aria-label="View provider details"
                    >
                      <span class="text-sm font-medium">View Details</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              {:else if getAddressSummary(message.id)}
                {@const addressSummary = getAddressSummary(message.id)}
                <div class="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="bg-purple-100 p-2 rounded-full">
                      <svg class="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div class="text-base font-bold text-purple-800">Address Located</div>
                      <div class="text-sm text-purple-600">Ready to use</div>
                    </div>
                  </div>
                  
                  <div class="bg-white bg-opacity-70 rounded-md p-3 mb-3">
                    <div class="text-sm text-gray-700 font-medium">
                      {addressSummary.address}
                    </div>
                    {#if addressSummary.name}
                      <div class="text-xs text-gray-500 mt-1">
                        {addressSummary.name}
                      </div>
                    {/if}
                  </div>
                  
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">{isRecentMessage ? 'Click to show on map' : 'Address from previous search'}</span>
                    {#if isRecentMessage}
                      <button 
                        class="flex items-center gap-1 text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors cursor-pointer"
                        on:click={() => handleMessageClick(message.id)}
                        aria-label="Show address location on map"
                      >
                        <span class="text-sm font-medium">Show Location</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    {:else}
                      <div class="flex items-center gap-1 text-gray-500">
                        <span class="text-sm italic">Previous Address</span>
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                </div>
              {:else}
                <!-- Fallback for other attachment types -->
                <div class="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-lg p-4">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="bg-blue-100 p-2 rounded-full">
                      <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div class="text-base font-bold text-blue-800">
                        {getAttachmentCount(message.id)} {getAttachmentCount(message.id) === 1 ? 'Attachment' : 'Attachments'}
                      </div>
                      <div class="text-sm text-blue-600">Click to view</div>
                    </div>
                  </div>
                  
                  <div class="bg-white bg-opacity-70 rounded-md p-3 mb-3">
                    <div class="text-sm text-gray-700">
                      {getAttachmentTypes(message.id).join(', ')}
                    </div>
                  </div>
                  
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">Click to reopen attachments</span>
                    {#if shouldBeClickable}
                      <button 
                        class="flex items-center gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors cursor-pointer"
                        on:click={() => handleMessageClick(message.id)}
                        aria-label="Open attachments"
                      >
                        <span class="text-sm font-medium">Open</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    {:else}
                      <div class="flex items-center gap-1 text-gray-500">
                        <span class="text-sm italic">Previous Result</span>
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
              
            </div>
          </div>
        {/if}
      {/each}
  
      {#if loading}
        <div class="flex justify-center" in:fade={{ duration: 300 }}>
          <div class="animate-pulse text-gray-500 flex items-center space-x-2">
            <div class="flex space-x-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
            <span>Thinking</span>
          </div>
        </div>
      {:else if isLoadingExample}
        <div class="flex justify-center" in:fade={{ duration: 300 }}>
          <div class="animate-pulse text-gray-500 flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            <span>Loading example conversation...</span>
          </div>
        </div>
      {/if}
  
      {#if error}
        <div class="bg-red-100 text-red-700 p-3 rounded-lg">
          {error}
        </div>
      {/if}
    </div>
    <!-- Input form (hidden during example viewing) -->
    {#if !isViewingExample}
      <form 
        on:submit|preventDefault={handleSubmit}
        class="border-t p-4 bg-white flex-shrink-0"
      >
        <div class="space-y-3">
          <textarea
            bind:value={userInput}
            placeholder={serverOnline ? "Type your message here... (Press Ctrl+Enter to send)" : "Chat is currently unavailable"}
            class="w-full h-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"   
            disabled={loading || !serverOnline}
            on:keydown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          ></textarea>
          <div class="flex justify-end">
            <button
              type="submit"
              disabled={loading || !serverOnline || !userInput.trim()}
              class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {#if loading}
                <div class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </div>
              {:else}
                Send Message
              {/if}
            </button>
          </div>
        </div>
      </form>
    {:else}
      <!-- Continue button for example viewing -->
      <div class="border-t p-4 bg-white flex-shrink-0">
        <div class="flex justify-end">
          {#if currentExampleIndex < totalExampleStates}
            <button
              on:click={continueExamplePlayback}
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 flex items-center space-x-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span>Continue</span>
            </button>
          {:else}
            <div class="text-sm text-gray-500 italic">
              Example completed
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Save as Example Modal -->
    {#if showExampleForm}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
        on:click={closeExampleForm}
        on:keydown={(e) => {
          if (e.key === 'Escape') {
            closeExampleForm();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="0"
      >
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div 
          class="bg-white rounded-lg p-6 w-full max-w-md mx-4" 
          on:click|stopPropagation
          on:keydown|stopPropagation
          role="document"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 id="modal-title" class="text-lg font-semibold text-gray-900">Save as Example</h3>
            <button 
              on:click={closeExampleForm} 
              class="text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <form on:submit|preventDefault={saveAsExample} class="space-y-4">
            <div>
              <label for="example-title" class="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                id="example-title"
                type="text"
                bind:value={exampleForm.title}
                placeholder="e.g., Booking a ride to Target"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label for="example-description" class="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="example-description"
                bind:value={exampleForm.description}
                placeholder="What does this conversation demonstrate?"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              ></textarea>
            </div>
            
            <div>
              <label for="example-tags" class="block text-sm font-medium text-gray-700 mb-1">
                Tags (optional)
              </label>
              <input
                id="example-tags"
                type="text"
                bind:value={exampleForm.tags}
                placeholder="e.g., booking, ride, accessibility (comma-separated)"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p class="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                on:click={closeExampleForm}
                class="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAsExample}
                class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {#if savingAsExample}
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Save Example</span>
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>

  <style>
    .chat-messages {
      scroll-behavior: smooth;
    }
    
    @keyframes bounce {
      0%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
    }
    
    .typing-cursor {
      display: inline-block;
      animation: blink 1s infinite;
      font-weight: bold;
      margin-left: 1px;
    }
    
    @keyframes blink {
      0%, 50% {
        opacity: 1;
      }
      51%, 100% {
        opacity: 0;
      }
    }
  </style>
