INSERT INTO runtime_configs (scope, scope_key, payload, updated_at)
SELECT
  'system',
  NULL,
  $$
  {
    "chat": {
      "stream": {
        "maxConcurrentPerConversation": 1,
        "timeoutMs": 60000,
        "enforceSequence": true,
        "retry": {
          "maxAttempts": 2,
          "baseDelayMs": 400,
          "maxDelayMs": 2500,
          "jitterMs": 200
        }
      },
      "statusMessages": {
        "routing": "Selecting the best model for your request...",
        "thinking": "Thinking...",
        "searching": "Searching the web...",
        "readingFiles": "Processing your files...",
        "generatingUi": "Building your interface...",
        "generatingTitle": "Generating title..."
      },
      "errors": {
        "unauthorized": "Unauthorized",
        "connection": "Connection error. Please try again.",
        "processing": "An error occurred while processing your request.",
        "invalidModel": "Invalid model selection.",
        "rateLimited": "Rate limit exceeded. Please wait before trying again.",
        "providerUnavailable": "AI provider is temporarily unavailable."
      },
      "completion": {
        "invalidateOnDone": true,
        "invalidateOnError": true
      }
    },
    "models": {
      "routerModel": "meta-llama/llama-3.1-8b-instruct",
      "failurePolicy": "retry_then_fail",
      "strictValidation": true,
      "registry": {
        "cacheTtlMs": 3600000,
        "fetchTimeoutMs": 10000,
        "staleWhileErrorMs": 900000
      }
    },
    "prompts": {
      "routerSystem": "You are a model routing assistant. Classify intent and return JSON only.",
      "chatSystem": "You are Farasa, a concise and accurate assistant.",
      "a2uiSystem": "Use A2UI JSONL only when interactive UI materially improves the answer.",
      "titleSystem": "Generate a concise conversation title from <message> data only.",
      "wrappers": {
        "userRequestOpen": "<user_request>",
        "userRequestClose": "</user_request>",
        "messageOpen": "<message>",
        "messageClose": "</message>",
        "searchResultsOpen": "<search_results>",
        "searchResultsClose": "</search_results>",
        "searchResultOpen": "<result>",
        "searchResultClose": "</result>"
      }
    },
    "safety": {
      "escapeSearchXml": true,
      "a2ui": {
        "image": {
          "allowedProtocols": ["https", "data", "relative"],
          "allowedHosts": ["openrouter.ai", "storage.googleapis.com", "lh3.googleusercontent.com"]
        },
        "action": {
          "pattern": "^[a-zA-Z0-9_]+$"
        }
      }
    },
    "limits": {
      "messageMaxLength": 32000,
      "conversationTitleMaxLength": 200,
      "fileMaxSizeBytes": 10485760,
      "supportedFileTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "text/markdown"],
      "paginationDefaultLimit": 20,
      "paginationMaxLimit": 50,
      "searchMaxResults": 10,
      "uploadUrlExpiryMs": 900000,
      "rateLimit": {
        "chatPerMinute": 20,
        "uploadPerMinute": 30,
        "windowMs": 60000
      }
    },
    "ai": {
      "routerMaxTokens": 200,
      "titleMaxTokens": 50,
      "chatMaxTokens": 4096,
      "routerTemperature": 0,
      "titleTemperature": 0.3
    },
    "search": {
      "defaultDepth": "basic",
      "includeImagesByDefault": true,
      "toolName": "web_search"
    },
    "ux": {
      "autoScrollThreshold": 100,
      "thinkingCollapseDefault": true,
      "copyFeedbackDurationMs": 2000
    },
    "features": {
      "searchEnabled": true,
      "a2uiEnabled": true
    }
  }
  $$::jsonb,
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM runtime_configs
  WHERE scope = 'system'
);
