# Chat Examples Configuration

## Overview

The chat examples demo system uses the `chatExamples.json` file to define automated conversation scenarios. This file can be easily modified to add, remove, or update demo scenarios without touching the code.

## File Structure

### Root Level
- `scenarios`: Array of demo scenario objects
- `config`: Global configuration settings
- `documentation`: Reference information for creating scenarios

### Scenario Object
```json
{
  "id": 1,
  "title": "Scenario Title",
  "description": "Brief description of what this demo shows",
  "conversation": [
    // Array of conversation steps
  ]
}
```

### Conversation Steps

#### Message Step
Represents a message from either the user or AI:
```json
{
  "type": "message",
  "role": "human",
  "content": "The message text to send",
  "delay": 1500,
  "waitForPreviousResponse": true
}
```

- `type`: Always "message"
- `role`: Either "human" or "ai"
- `content`: The text of the message
- `delay`: (Optional) Milliseconds to wait before showing this message
- `waitForPreviousResponse`: (Optional) If true, waits for AI response before continuing

#### Wait Step
Represents a pause in the conversation:
```json
{
  "type": "wait",
  "duration": 3000,
  "showThinking": true
}
```

- `type`: Always "wait"
- `duration`: Milliseconds to wait
- `showThinking`: (Optional) If true, shows "AI is thinking..." indicator

## Configuration Options

### Global Config
```json
"config": {
  "defaultMessageDelay": 2000,
  "defaultWaitDuration": 3000,
  "maxScenariosToShow": 8
}
```

- `defaultMessageDelay`: Default delay between messages (ms)
- `defaultWaitDuration`: Default wait duration (ms)
- `maxScenariosToShow`: Maximum number of scenarios to display

## Adding New Scenarios

1. Open `chatExamples.json`
2. Add a new scenario object to the `scenarios` array
3. Give it a unique `id` (increment from the highest existing ID)
4. Add a descriptive `title` and `description`
5. Create the `conversation` array with appropriate steps
6. Save the file

The changes will be reflected immediately when the page is refreshed.

## Best Practices

### Message Timing
- Use 1500-2000ms delays for natural conversation flow
- Longer delays (2500-3000ms) for complex questions
- Shorter delays (1000ms) for quick follow-ups

### Conversation Flow
- Start with the user's initial question
- Use `waitForPreviousResponse: true` for follow-up questions
- Include appropriate wait steps with `showThinking: true`
- Keep messages realistic and conversational

### Scenario Planning
- Focus on different use cases (local trips, accessibility needs, etc.)
- Test various conversation patterns
- Include both simple and complex multi-step scenarios
- Cover edge cases (early morning, unusual routes, etc.)

## Examples

### Simple Scenario
```json
{
  "id": 11,
  "title": "Quick Local Trip",
  "description": "Simple one-step transportation request",
  "conversation": [
    {
      "type": "message",
      "role": "human",
      "content": "I need to get from downtown Walnut Creek to the library",
      "delay": 1500
    },
    {
      "type": "wait",
      "duration": 3000,
      "showThinking": true
    }
  ]
}
```

### Complex Multi-Step Scenario
```json
{
  "id": 12,
  "title": "Detailed Accessibility Planning",
  "description": "Multi-step conversation with specific requirements",
  "conversation": [
    {
      "type": "message",
      "role": "human",
      "content": "I need help planning transportation for my disabled spouse",
      "delay": 1500
    },
    {
      "type": "wait",
      "duration": 2500,
      "showThinking": true
    },
    {
      "type": "message",
      "role": "human",
      "content": "They use a power wheelchair and we need door-to-door service",
      "delay": 2000,
      "waitForPreviousResponse": true
    },
    {
      "type": "wait",
      "duration": 3000,
      "showThinking": true
    },
    {
      "type": "message",
      "role": "human",
      "content": "The trip is from our home in Rossmoor to UCSF for regular medical treatments",
      "delay": 2000,
      "waitForPreviousResponse": true
    },
    {
      "type": "wait",
      "duration": 3500,
      "showThinking": true
    }
  ]
}
```