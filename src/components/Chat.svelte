<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { PROVIDERS_API_BASE, CHAT_API_URL } from '../config';
    import { fade, fly, slide } from 'svelte/transition';
    import { serviceZoneManager } from '../lib/serviceZoneManager.js';
    import { marked } from 'marked';

    // Configure marked for safe rendering
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // Render markdown to HTML
    function renderMarkdown(content) {
        if (!content) return '';
        return marked.parse(content);
    }

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
        content: `Hello! I'm your OPTIMAT transportation assistant. Here's what I can help you with:

**🔍 Find Providers** - Search for paratransit and transportation providers based on your pickup and drop-off locations

**📍 Address Search** - Look up and validate addresses to ensure accurate provider matching

**📋 Provider Details** - Get detailed information about specific providers including contact info, eligibility, and service hours

**🌐 General Questions** - Answer questions about paratransit services, accessibility requirements, and transportation options

How can I assist you today?`,
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

    // SSE Streaming state
    let streamingMessage = ''; // Current streaming message content
    let currentTool = null; // Current tool being executed (name and status)
    let isStreaming = false; // Whether we're in streaming mode

    // Provider results bottom bar state
    let latestProviderResults = null; // Most recent provider search results
    let selectedProvider = null; // Currently selected provider for detail view
    let detailPanelHeight = 280; // Height of detail panel in pixels
    let isDetailPanelOpen = false; // Whether detail panel is visible
    let isResizing = false; // Whether user is resizing the panel

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
        
        // Normalize provider attachment data (can arrive as JSON string)
        let data = providerAttachment.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.warn('Failed to parse provider attachment data', e);
                return null;
            }
        }

        const providers = Array.isArray(data?.data) ? data.data : [];
        const publicTransit = data?.public_transit;
        
        return {
            count: providers.length,
            sourceAddress: data.source_address,
            destinationAddress: data.destination_address,
            providers: providers.slice(0, 3), // Show first 3
            moreCount: Math.max(0, providers.length - 3),
            hasPublicTransit: publicTransit && publicTransit.routes && publicTransit.routes.length > 0,
            allProviders: providers, // Keep reference to all providers
            publicTransit: publicTransit
        };
    }

    // Provider bar functions
    function updateLatestProviderResults(attachments) {
        if (!attachments) return;
        const providerAttachment = attachments.find(att => att.type === 'provider_search');
        if (providerAttachment && providerAttachment.data) {
            let data = providerAttachment.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { return; }
            }
            const providers = Array.isArray(data?.data) ? data.data : [];
            latestProviderResults = {
                providers: providers,
                sourceAddress: data.source_address,
                destinationAddress: data.destination_address,
                publicTransit: data.public_transit
            };
            // Auto-open detail panel if we have results
            if (providers.length > 0 && !isDetailPanelOpen) {
                selectedProvider = providers[0];
                isDetailPanelOpen = true;
                // Auto-show first provider's zone
                showProviderZoneOnMap(providers[0]);
            }
        }
    }

    function selectProvider(provider) {
        selectedProvider = provider;
        isDetailPanelOpen = true;
        showProviderZoneOnMap(provider);
    }

    function showProviderZoneOnMap(provider) {
        if (!provider) return;
        const providerId = provider.provider_id || provider.id;
        // Hide all other zones first
        serviceZoneManager.clearAllServiceZones();
        visibleProviderZones.clear();
        visibleProviderZones = new Set(visibleProviderZones);

        // Show this provider's zone
        if (provider.service_zone) {
            try {
                const geoJson = typeof provider.service_zone === 'string'
                    ? JSON.parse(provider.service_zone)
                    : provider.service_zone;

                serviceZoneManager.addServiceZone({
                    type: 'provider',
                    geoJson: geoJson,
                    label: provider.provider_name,
                    description: `${provider.provider_name} service area`,
                    metadata: { providerId: providerId, provider: provider },
                    config: { color: '#8b5cf6', fillOpacity: 0.15 }
                }, false);

                visibleProviderZones.add(providerId);
                visibleProviderZones = new Set(visibleProviderZones);
            } catch (e) {
                console.error('Error parsing provider service zone:', e);
            }
        }
    }

    function closeDetailPanel() {
        isDetailPanelOpen = false;
        selectedProvider = null;
        // Clear service zones when closing
        serviceZoneManager.clearAllServiceZones();
        visibleProviderZones.clear();
        visibleProviderZones = new Set(visibleProviderZones);
    }

    function startResize(e) {
        isResizing = true;
        const startY = e.clientY;
        const startHeight = detailPanelHeight;

        function onMouseMove(e) {
            const delta = startY - e.clientY;
            detailPanelHeight = Math.max(150, Math.min(500, startHeight + delta));
        }

        function onMouseUp() {
            isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    function getProviderTypeIcon(type) {
        if (type?.includes('paratransit') || type?.includes('ADA')) return '♿';
        if (type?.includes('fix') || type?.includes('fixed')) return '🚌';
        if (type?.includes('dial') || type?.includes('demand')) return '📞';
        return '🚐';
    }

    function getProviderTypeColor(type) {
        if (type?.includes('paratransit') || type?.includes('ADA')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (type?.includes('fix') || type?.includes('fixed')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (type?.includes('dial') || type?.includes('demand')) return 'bg-green-100 text-green-700 border-green-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
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
                // Normalize provider payload (may arrive as JSON string or nested data)
                let providerPayload = providerAttachment.data;
                if (typeof providerPayload === 'string') {
                    try {
                        providerPayload = JSON.parse(providerPayload);
                    } catch (e) {
                        console.warn('Failed to parse provider attachment payload', e);
                        providerPayload = null;
                    }
                }
                if (providerPayload && providerPayload.data && !Array.isArray(providerPayload.data) && Array.isArray(providerPayload.data.data)) {
                    providerPayload = { ...providerPayload, data: providerPayload.data.data };
                }
                if (!providerPayload) return;
                
                // Clear existing service zones when showing new provider results
                serviceZoneManager.clearAllServiceZones();
                visibleProviderZones.clear();
                loadingProviderZones.clear();
                
                // Process provider data and add to service zone manager
                const providerData = providerPayload;
                if (Array.isArray(providerData.data) && providerData.data.length > 0) {
                    // Add all provider service zones to the manager (but don't focus yet)
                    serviceZoneManager.addProviderServiceZones(providerData.data, false);
                }
                
                // Emit provider data for the popup
                dispatch('providersFound', providerData);
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
      isStreaming = true;
      streamingMessage = '';
      currentTool = null;
      error = null;

      const newMessage = {
        role: 'human',
        content: userInput,
        id: `human-${Date.now()}`
      };

      messages = [...messages, newMessage];
      userInput = '';
      scrollToBottom();

      // Create placeholder for streaming AI response
      const streamingMessageId = `streaming-${Date.now()}`;
      let pendingAttachments = [];

      try {
        const response = await fetch(`${CHAT_API_BASE}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_message: newMessage,
            conversation_id: conversationId
          })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));

                switch (event.event) {
                  case 'tool_start':
                    // Clear previous streaming text and show new tool
                    streamingMessage = '';
                    currentTool = { name: event.tool, status: 'running' };
                    scrollToBottom();
                    break;

                  case 'tool_end':
                    // Mark tool as done, it will be hidden when streaming resumes
                    if (currentTool && currentTool.name === event.tool) {
                      currentTool = { ...currentTool, status: 'done' };
                    }
                    break;

                  case 'token':
                    // Hide tool indicator when text starts streaming
                    if (currentTool && currentTool.status === 'done') {
                      currentTool = null;
                    }
                    streamingMessage += event.content;
                    scrollToBottom();
                    break;

                  case 'message':
                    // Final message received
                    streamingMessage = event.content;
                    break;

                  case 'done':
                    pendingAttachments = event.attachments || [];
                    break;

                  case 'error':
                    error = event.message;
                    break;
                }
              } catch (e) {
                console.warn('Failed to parse SSE event:', line, e);
              }
            }
          }
        }

        // Add final message
        if (streamingMessage.trim()) {
          const finalMessage = {
            role: 'ai',
            content: streamingMessage,
            id: streamingMessageId
          };
          messages = [...messages, finalMessage];

          // Handle attachments
          if (pendingAttachments.length > 0) {
            messageAttachments.set(streamingMessageId, pendingAttachments);
            messageAttachments = messageAttachments;

            // Update the bottom provider bar with latest results
            updateLatestProviderResults(pendingAttachments);

            // Auto-open provider results in popup
            const hasProviderAttachment = pendingAttachments.some(att => att.type === 'provider_search');
            if (hasProviderAttachment) {
              setTimeout(() => handleMessageClick(streamingMessageId), 100);
            }
          }
        }

        scrollToBottom();

      } catch (e) {
        error = e.message;
        console.error('SSE error:', e);
      } finally {
        loading = false;
        isStreaming = false;
        streamingMessage = '';
        currentTool = null;
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
        content: `Hello! I'm your OPTIMAT transportation assistant. Here's what I can help you with:

**🔍 Find Providers** - Search for paratransit and transportation providers based on your pickup and drop-off locations

**📍 Address Search** - Look up and validate addresses to ensure accurate provider matching

**📋 Provider Details** - Get detailed information about specific providers including contact info, eligibility, and service hours

**🌐 General Questions** - Answer questions about paratransit services, accessibility requirements, and transportation options

How can I assist you today?`,
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
  <div class="flex flex-col h-full bg-background">
    <!-- Top status bar -->
    {#if !serverOnline || isViewingExample}
      <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
        {#if !serverOnline}
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-destructive"></div>
            <span class="text-xs text-muted-foreground">Chat server offline</span>
          </div>
        {:else if isViewingExample}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">📖 Viewing Example</span>
            </div>
            <button
              on:click={startNewConversation}
              class="text-xs text-primary hover:text-primary/80 transition"
            >
              New Chat
            </button>
          </div>
        {/if}
      </div>
    {/if}
  
    <!-- Chat messages -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3 chat-messages scroll-smooth">
      {#each messages.filter(m => (m.role === 'ai' || m.role === 'human') && typeof m.content === 'string' && m.content.trim() !== '') as message, index (message.id || `${message.role}-${index}-${message.content.substring(0, 20)}`)}
        <div
          class="flex gap-2 {message.role === 'human' ? 'justify-end' : 'justify-start'}"
          in:fly={{
            x: message.role === 'human' ? 20 : -20,
            y: 0,
            duration: 300,
            delay: 0
          }}
        >
          {#if message.role === 'ai'}
            <div class="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs">
              🤖
            </div>
          {/if}

          <div class="max-w-[75%] {
            message.role === 'human'
              ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2'
              : 'bg-muted text-foreground rounded-2xl rounded-tl-sm px-3 py-2'
          }">
            {#if message.role === 'human'}
              <p class="text-sm whitespace-pre-wrap">{message.content}</p>
            {:else}
              <!-- AI message with markdown rendering -->
              <div class="text-sm chat-markdown">
                {@html renderMarkdown(message.content)}
              </div>
            {/if}
          </div>

          {#if message.role === 'human'}
            <div class="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs">
              👤
            </div>
          {/if}
        </div>
      {/each}
  
      {#if loading || isStreaming}
        <div class="flex gap-2 justify-start" in:fade={{ duration: 300 }}>
          <div class="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-xs thinking-avatar">
            🧠
          </div>
          <div class="thinking-bubble rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%]">
            <!-- Show current thought: either tool call or streaming text -->
            {#if currentTool}
              <!-- Current tool being executed -->
              <div class="flex items-center gap-2 text-sm">
                {#if currentTool.status === 'running'}
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent"></div>
                  <span class="text-purple-600 dark:text-purple-300 font-medium">
                    {#if currentTool.name === 'search_addresses_from_user_query'}
                      🔍 Searching for addresses...
                    {:else if currentTool.name === 'find_providers'}
                      🚌 Finding transportation providers...
                    {:else if currentTool.name === 'get_provider_info'}
                      📋 Looking up provider details...
                    {:else}
                      ⚙️ {currentTool.name}...
                    {/if}
                  </span>
                {:else}
                  <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span class="text-green-600 dark:text-green-400 font-medium">
                    {#if currentTool.name === 'search_addresses_from_user_query'}
                      ✓ Found addresses
                    {:else if currentTool.name === 'find_providers'}
                      ✓ Found providers
                    {:else if currentTool.name === 'get_provider_info'}
                      ✓ Got provider info
                    {:else}
                      ✓ {currentTool.name} complete
                    {/if}
                  </span>
                {/if}
              </div>
            {:else if streamingMessage}
              <!-- Streaming AI response -->
              <div class="text-sm prose prose-sm dark:prose-invert max-w-none chat-markdown">
                {@html renderMarkdown(streamingMessage)}
                <span class="typing-cursor inline-block ml-0.5">▊</span>
              </div>
            {:else}
              <!-- Initial thinking indicator -->
              <div class="flex items-center gap-2">
                <div class="flex space-x-1">
                  <div class="w-1.5 h-1.5 bg-purple-500/70 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-1.5 h-1.5 bg-purple-500/70 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-1.5 h-1.5 bg-purple-500/70 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-sm text-purple-600 dark:text-purple-300 font-medium">Thinking...</span>
              </div>
            {/if}
          </div>
        </div>
      {:else if isLoadingExample}
        <div class="flex gap-2 justify-start" in:fade={{ duration: 300 }}>
          <div class="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <div class="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent"></div>
          </div>
          <div class="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
            <span class="text-sm text-muted-foreground">Loading example...</span>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="bg-destructive/10 border border-destructive/40 text-destructive p-3 rounded-lg text-sm">
          {error}
        </div>
      {/if}
    </div>

    <!-- Input form (hidden during example viewing) -->
    {#if !isViewingExample}
      <form
        on:submit|preventDefault={handleSubmit}
        class="flex-shrink-0 border-t border-border/40 bg-card px-3 py-3"
      >
        <div class="flex gap-2">
          <textarea
            bind:value={userInput}
            placeholder={serverOnline ? "Type your message..." : "Chat unavailable"}
            class="flex-1 resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] max-h-[120px]"
            disabled={loading || !serverOnline}
            on:keydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          ></textarea>
          <button
            type="submit"
            disabled={loading || !serverOnline || !userInput.trim()}
            class="self-end px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium h-fit"
          >
            {#if loading}
              <div class="flex items-center gap-2">
                <div class="animate-spin rounded-full h-3 w-3 border-2 border-primary-foreground border-t-transparent"></div>
                <span>Send</span>
              </div>
            {:else}
              Send
            {/if}
          </button>
        </div>
        {#if serverOnline}
          <div class="text-[10px] text-muted-foreground mt-1.5 px-1">
            Enter to send · Shift+Enter for new line
          </div>
        {/if}
      </form>
    {:else}
      <!-- Continue button for example viewing -->
      <div class="flex-shrink-0 border-t border-border/40 bg-card px-3 py-3">
        <div class="flex justify-end">
          {#if currentExampleIndex < totalExampleStates}
            <button
              on:click={continueExamplePlayback}
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm font-medium flex items-center gap-2"
            >
              <span>Continue</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          {:else}
            <div class="text-sm text-muted-foreground italic">
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
      color: #a855f7;
    }

    @keyframes blink {
      0%, 50% {
        opacity: 1;
      }
      51%, 100% {
        opacity: 0;
      }
    }

    /* Thinking bubble styles */
    .thinking-bubble {
      background: linear-gradient(135deg,
        rgba(168, 85, 247, 0.08) 0%,
        rgba(59, 130, 246, 0.08) 50%,
        rgba(168, 85, 247, 0.08) 100%
      );
      border: 1px solid rgba(168, 85, 247, 0.25);
      box-shadow:
        0 0 15px rgba(168, 85, 247, 0.1),
        0 0 30px rgba(59, 130, 246, 0.05);
      animation: thinking-glow 2s ease-in-out infinite;
    }

    @keyframes thinking-glow {
      0%, 100% {
        box-shadow:
          0 0 15px rgba(168, 85, 247, 0.1),
          0 0 30px rgba(59, 130, 246, 0.05);
        border-color: rgba(168, 85, 247, 0.25);
      }
      50% {
        box-shadow:
          0 0 20px rgba(168, 85, 247, 0.2),
          0 0 40px rgba(59, 130, 246, 0.1);
        border-color: rgba(168, 85, 247, 0.4);
      }
    }

    .thinking-avatar {
      animation: thinking-pulse 2s ease-in-out infinite;
    }

    @keyframes thinking-pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.05);
        opacity: 0.9;
      }
    }

    /* Dark mode adjustments for thinking bubble */
    :global(.dark) .thinking-bubble {
      background: linear-gradient(135deg,
        rgba(168, 85, 247, 0.12) 0%,
        rgba(59, 130, 246, 0.12) 50%,
        rgba(168, 85, 247, 0.12) 100%
      );
      border-color: rgba(168, 85, 247, 0.35);
    }

    /* Chat markdown styles with better spacing */
    .chat-markdown {
      line-height: 1.6;
    }

    .chat-markdown :global(p) {
      margin-top: 0.75em;
      margin-bottom: 0.75em;
    }

    .chat-markdown :global(p:first-child) {
      margin-top: 0;
    }

    .chat-markdown :global(p:last-child) {
      margin-bottom: 0;
    }

    .chat-markdown :global(ul),
    .chat-markdown :global(ol) {
      margin-top: 0.75em;
      margin-bottom: 0.75em;
      padding-left: 1.5em;
    }

    .chat-markdown :global(li) {
      margin-top: 0.4em;
      margin-bottom: 0.4em;
    }

    .chat-markdown :global(li p) {
      margin-top: 0.25em;
      margin-bottom: 0.25em;
    }

    .chat-markdown :global(strong) {
      font-weight: 600;
      color: inherit;
    }

    .chat-markdown :global(h1),
    .chat-markdown :global(h2),
    .chat-markdown :global(h3) {
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }

    .chat-markdown :global(h1:first-child),
    .chat-markdown :global(h2:first-child),
    .chat-markdown :global(h3:first-child) {
      margin-top: 0;
    }

    .chat-markdown :global(code) {
      background: rgba(0, 0, 0, 0.08);
      padding: 0.15rem 0.35rem;
      border-radius: 0.25rem;
      font-size: 0.85em;
      font-family: ui-monospace, monospace;
    }

    :global(.dark) .chat-markdown :global(code) {
      background: rgba(255, 255, 255, 0.12);
    }

    .chat-markdown :global(pre) {
      background: rgba(0, 0, 0, 0.05);
      padding: 0.75em 1em;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 0.75em 0;
    }

    :global(.dark) .chat-markdown :global(pre) {
      background: rgba(255, 255, 255, 0.08);
    }

    .chat-markdown :global(a) {
      color: #3b82f6;
      text-decoration: underline;
    }

    .chat-markdown :global(a:hover) {
      color: #2563eb;
    }

    .chat-markdown :global(blockquote) {
      border-left: 3px solid rgba(168, 85, 247, 0.4);
      padding-left: 1em;
      margin: 0.75em 0;
      color: inherit;
      opacity: 0.9;
    }

    .chat-markdown :global(hr) {
      border: none;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      margin: 1em 0;
    }

    :global(.dark) .chat-markdown :global(hr) {
      border-top-color: rgba(255, 255, 255, 0.1);
    }
  </style>
