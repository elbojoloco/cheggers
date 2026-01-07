const kickChannelId = '1820052'
const pusherAppId = '32cbd69e4b950bf97679'
const pusherCluster = 'us2'
const kickChatroom = `chatrooms.${kickChannelId}.v2`
const messageEvent = 'App\\Events\\ChatMessageEvent'
const emoteMessageRegex = /^\[emote:\d+:[a-zA-Z]+]$/gm
const cheggersEmote = '[emote:2836117:grossgoreCheggers]'
const defaultEmote = '[emote:1730794:emojiLol]'

// IDEA: TTS library with quicksend button
// IDEA: Overwrite emote click handler to bypass rate limit & allow setting the amount of emotes to send

/**
 * This script is designed to be run in the browser console on the Kick website.
 * It listens for chat messages in the chatroom and counts the number of cheggers
 * emotes used per minute, broadcasting the average every 45 seconds.
 *
 * It also listens for emote messages and counts the number of consecutive emotes
 * used in a row, broadcasting the streak when it ends.
 *
 * FEEL FREE TO PLAY AROUND WITH VARIABLES BELOW
 */

// Decides how many seconds are between CPM broadcasts
const cheggersPerMinuteBroadcastInterval = 45

// Decides how many seconds should be between streak broadcasts
const emoteStreakCollectionCooldown = 5

// The current known longest emote streak
let longestStreak = 0

// How long a streak must be at least to count
const emoteStreakMinimum = 5

// How many miliseconds to wait before ending an emote streak, if no
// matching emote is used within this time from the previous one
// the streak will be broadcasted and reset.
const emoteStreakInterval = 2000

/**
 * Tate
mura
Cena
Pooh
tino
witch
dmx
dogg
randy
Ebz
Pegasus
Hartman
2pac
smith
Keith
Greta
jax
alig
phil
mike
Green
George
Woken
Kermit
Elmo
snape
AngryGore
Arnold
Gross
starwars
marley
Butcher
roz
Homero
Krabs
jr
gollum
Cent
Alex
Hawking
vader
Borat
plankton
cartman
dagoth
farage
Kaiba
Dj
Trump
Morgan
gordon
buu
hagrid
Rogan
kim
indian
ewu
fat
spongebob
drunk
brian
Glittery
yoda
krusty
 */

// Available TTS voices (static list - user can customize this array)
const availableVoices = [
  'snape',
  'phil',
  'plankton',
  'gollum',
  'witch',
  'glittery',
  'krusty',
  'kim',
  'spongebob', 
  'drunk',
  'brian',
  'gordon',
  'kaiba',
  'yoda',
  'vader',
  'jr',
  'marley',
  'kermit',
  'alig',
]

// Selected voices (starts with default)
let voices = ['snape']

// TTS cooldown tracking
let ttsCooldownEndTime = 0
const ttsCooldownDuration = 120000 // 2 minutes in milliseconds

// Current TTS message to send
let currentTtsMessage = ''

// Minimize state
let isMinimized = false

/**
 * !!! STOP EDITING BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING !!!
 */

const pusher = new Pusher(pusherAppId, {
  cluster: pusherCluster,
})

const channel = pusher.subscribe(kickChatroom)

let filteredEmotes = []

// Fuzzy search case insensitive for emotes
function searchEmote(name) {
  filteredEmotes = emotes.filter(emote =>
    emote.name.toLowerCase().includes(name.toLowerCase())
  )

  console.log(filteredEmotes)

  redrawHtml()

  return filteredEmotes
}

function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
}

function redrawHtml() {
  const emoteList = document.getElementById('emotes')

  emoteList.innerHTML = filteredEmotes
    .map(emote => `<option value="${emote.id}">${emote.name}</option>`)
    .join('')
}

const addHtmlToBody = html => {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
}

const auth = 'Bearer ' + decodeURI(getCookie('session_token'))

let username = ''

const getUser = async () => {
  const res = await fetch('https://kick.com/api/v1/user', {
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,de;q=0.7',
      authorization: auth,
      'x-xsrf-token': decodeURI(getCookie('XSRF-TOKEN')),
    },
  })

  const data = await res.json()

  username = data.username
}

getUser()

const emotes = []

const updateEmotePreviewSrc = () => {
  const selectedEmote = document.getElementById('selectedemote').value

  const emote = emotes.find(e => e.name === selectedEmote)

  if (emote === undefined) {
    return
  }

  document.getElementById('emotepreview').src = emote.image
}

// Toggle minimize/maximize
const toggleMinimize = () => {
  isMinimized = !isMinimized
  const cheggersDiv = document.querySelector('.cheggers')
  const cheggersContent = document.getElementById('cheggers-content')
  const minimizeBtn = document.getElementById('minimize-btn')
  const header = document.querySelector('.cheggers-header')
  
  if (cheggersDiv && cheggersContent && minimizeBtn) {
    if (isMinimized) {
      cheggersDiv.classList.add('minimized')
      minimizeBtn.textContent = '▲'
      minimizeBtn.title = 'Expand'
      if (header) {
        header.style.cursor = 'pointer'
      }
    } else {
      cheggersDiv.classList.remove('minimized')
      minimizeBtn.textContent = '▼'
      minimizeBtn.title = 'Minimize'
      if (header) {
        header.style.cursor = 'pointer'
      }
    }
  }
}

// Toggle voice checkbox
const toggleVoice = (voiceName) => {
  const index = voices.indexOf(voiceName)
  if (index > -1) {
    voices.splice(index, 1)
  } else {
    voices.push(voiceName)
  }
  
  // Update checkbox state
  const checkbox = document.getElementById(`voice-${voiceName}`)
  if (checkbox) {
    checkbox.checked = voices.includes(voiceName)
  }
  
  // Update status
  const voicesStatus = document.getElementById('voices-status')
  if (voicesStatus) {
    if (voices.length === 0) {
      voicesStatus.textContent = '⚠ At least one voice must be selected'
      voicesStatus.style.color = '#ff6464'
    } else {
      voicesStatus.textContent = `✓ ${voices.length} voice(s) active`
      voicesStatus.style.color = '#00ff88'
    }
    setTimeout(() => {
      if (voices.length > 0) {
        voicesStatus.textContent = ''
      }
    }, 2000)
  }
  
  console.log('Voices updated:', voices)
}

const getEmotes = async () => {
  const res = await fetch('https://kick.com/emotes/grossgore', {
    headers: {
      accept: 'application/json',
      'accept-language': 'en-GB,en;q=0.9',
      cluster: 'v2',
    },
  })

  const data = await res.json()

  data.forEach(source => {
    source.emotes.forEach(emote => {
      emotes.push({
        id: emote.id,
        name: emote.name,
        image: `https://files.kick.com/emotes/${emote.id}/fullsize`,
      })
    })
  })

  addHtmlToBody(`
    <div class="cheggers">
      <div class="cheggers-header" onclick="toggleMinimize()">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h1>KICK+</h1>
          <button id="minimize-btn" class="minimize-btn" onclick="event.stopPropagation(); toggleMinimize();" title="Minimize">▼</button>
        </div>
        <div id="tts-cooldown" class="tts-cooldown" onclick="event.stopPropagation();">TTS Ready</div>
      </div>

      <div id="cheggers-content" class="cheggers-content">
        <div class="cheggers-section">
          <h2 class="section-title">TTS Generator</h2>
          <div class="cheggers-section-inner">
            <label class="cheggers-label">TTS Voices</label>
            <div class="voices-checkbox-container">
              ${availableVoices.map(voice => `
                <label class="voice-checkbox-label">
                  <input 
                    type="checkbox" 
                    id="voice-${voice}" 
                    class="voice-checkbox" 
                    ${voices.includes(voice) ? 'checked' : ''}
                    onchange="toggleVoice('${voice}')"
                  />
                  <span class="voice-checkbox-button ${voices.includes(voice) ? 'active' : ''}">${voice}</span>
                </label>
              `).join('')}
            </div>
            <div id="voices-status" class="voices-status"></div>
          </div>
          <button class="cheggers-btn cheggers-btn-primary" onclick="sendRandomTts()">
            📢 Generate TTS
          </button>
          <div id="tts-preview-info" class="tts-preview-info">
            <div class="tts-info-placeholder">Generate a TTS message to see preview</div>
          </div>
          <button id="send-tts-btn" class="cheggers-btn cheggers-btn-send" onclick="sendTtsMessage()" style="display: none;">
            ✉️ Send TTS
          </button>
          <div class="words-stats">
            <span id="words-count">Words collected: ${words.length}</span>
          </div>
        </div>

        <div class="cheggers-section">
          <h2 class="section-title">Emote Flashbang</h2>
          <div class="emote-preview-container">
            <img id="emotepreview" src="https://files.kick.com/emotes/1730794/fullsize" alt="Cheggers" class="emote-preview">
          </div>
          <label class="cheggers-label" for="selectedemote">Emote to spam</label>
          <input type="text" id="selectedemote" class="cheggers-input" placeholder="Search emotes" list="emotes" value="emojiLol" onInput="updateEmotePreviewSrc()" />
          <datalist id="emotes">
            ${emotes
              .map(emote => `<option value="${emote.name}"></option>`)
              .join('')}
          </datalist>

          <div class="input-group">
            <div class="input-group-item">
              <label class="cheggers-label" for="emoteamount">Per message</label>
              <input type="number" id="emoteamount" class="cheggers-input cheggers-input-small" placeholder="Amount" value="1" min="1" max="14" />
            </div>
            <div class="input-group-item">
              <label class="cheggers-label" for="messageamount">Messages</label>
              <input type="number" id="messageamount" class="cheggers-input cheggers-input-small" placeholder="Amount" value="1" min="1" max="15" />
            </div>
          </div>
          <button class="cheggers-btn" onclick="emoteFlashbang()">💥 Emote Flashbang</button>
        </div>
      </div>
    </div>
  
    <style>
      .cheggers {
        position: fixed;
        left: 10px;
        bottom: 10px;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        color: #fff;
        padding: 20px;
        z-index: 9999;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        max-width: 350px;
        max-height: 90vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .cheggers-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 30px;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
      }

      .cheggers.minimized .cheggers-header {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
        cursor: default;
      }

      .minimize-btn {
        background: rgba(255, 255, 255, 0.15);
        border: 2px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        border-radius: 4px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        padding: 0;
        font-weight: 600;
      }

      .minimize-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.5);
      }

      .minimize-btn:focus {
        outline: 2px solid #00ff88;
        outline-offset: 2px;
      }

      .cheggers-content {
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .cheggers.minimized .cheggers-content {
        display: none;
      }

      .cheggers h1 {
        margin: 0;
        font-size: 26px;
        font-weight: 700;
        background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .tts-cooldown {
        font-size: 13px;
        padding: 8px 14px;
        background: rgba(0, 255, 136, 0.25);
        border-radius: 6px;
        font-weight: 600;
        color: #00ff88;
        transition: all 0.3s ease;
        min-height: 20px;
        display: flex;
        align-items: center;
      }

      .tts-cooldown.active {
        background: rgba(255, 100, 100, 0.3);
        color: #ff6464;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .cheggers-section {
        margin-bottom: 25px;
      }

      .section-title {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 14px 0;
        color: #d0d0d0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tts-preview-info {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 14px;
        margin-top: 14px;
        font-size: 13px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .tts-info-placeholder {
        color: #b0b0b0;
        font-style: italic;
      }

      .tts-info-header {
        font-weight: 600;
        margin-bottom: 10px;
        color: #00ff88;
        font-size: 14px;
      }

      .tts-info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .tts-info-row:last-child {
        margin-bottom: 0;
      }

      .tts-info-label {
        color: #d0d0d0;
        font-weight: 500;
      }

      .tts-info-value {
        color: #fff;
        font-weight: 500;
      }

      .tts-message-preview {
        word-break: break-word;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 15px;
        white-space: pre-wrap;
        max-width: 100%;
        overflow-wrap: break-word;
        line-height: 1.6;
        color: #fff;
        font-weight: 400;
      }

      .cheggers-section-inner {
        margin-bottom: 12px;
      }

      .cheggers-btn-small {
        flex-shrink: 0;
        width: auto;
        min-width: 40px;
        padding: 10px 12px;
        margin-bottom: 0;
      }

      .voices-checkbox-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .voice-checkbox-label {
        display: inline-flex;
        cursor: pointer;
        user-select: none;
      }

      .voice-checkbox {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }

      .voice-checkbox-button {
        display: inline-block;
        padding: 8px 14px;
        background-color: rgba(0, 0, 0, 0.4);
        color: #e0e0e0;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        text-align: center;
        min-width: 60px;
      }

      .voice-checkbox-button:hover {
        background-color: rgba(0, 0, 0, 0.6);
        border-color: rgba(255, 255, 255, 0.4);
        color: #fff;
      }

      .voice-checkbox:checked + .voice-checkbox-button,
      .voice-checkbox-button.active {
        background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
        color: #000;
        border-color: #00ff88;
        font-weight: 600;
      }

      .voice-checkbox:focus + .voice-checkbox-button {
        outline: 2px solid #00ff88;
        outline-offset: 2px;
      }

      .voices-status {
        font-size: 13px;
        color: #00ff88;
        margin-top: 8px;
        min-height: 20px;
        font-weight: 500;
      }

      .words-stats {
        font-size: 13px;
        color: #b0b0b0;
        margin-top: 10px;
        text-align: center;
        font-weight: 500;
      }

      .emote-preview-container {
        display: flex;
        justify-content: center;
        margin-bottom: 12px;
      }

      .emote-preview {
        width: auto;
        height: 60px;
        border-radius: 8px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.3);
        padding: 4px;
      }

      .cheggers-label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #e0e0e0;
      }

      .cheggers-input {
        display: block;
        width: 100%;
        margin-bottom: 12px;
        padding: 12px 14px;
        background-color: rgba(0, 0, 0, 0.5);
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        font-size: 15px;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }

      .cheggers-input:focus {
        outline: 2px solid #00ff88;
        outline-offset: 2px;
        border-color: #00ff88;
        background-color: rgba(0, 0, 0, 0.7);
      }

      .cheggers-input::placeholder {
        color: #999;
      }

      .input-group {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
      }

      .input-group-item {
        flex: 1;
      }

      .cheggers-input-small {
        margin-bottom: 0;
      }

      .cheggers-btn {
        display: block;
        width: 100%;
        margin-bottom: 12px;
        padding: 14px;
        background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
        color: #000;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
      }

      .cheggers-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 255, 136, 0.4);
      }

      .cheggers-btn:active {
        transform: translateY(0);
      }

      .cheggers-btn-primary {
        background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
      }

      .cheggers-btn-primary:hover {
        box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
      }

      .cheggers-btn-send {
        background: linear-gradient(135deg, #00ccff 0%, #0099ff 100%);
        box-shadow: 0 4px 12px rgba(0, 204, 255, 0.3);
      }

      .cheggers-btn-send:hover {
        box-shadow: 0 6px 16px rgba(0, 204, 255, 0.4);
      }

      .cheggers-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        box-shadow: none;
      }

      .cheggers-btn:disabled:hover {
        transform: none;
      }

      /* Scrollbar styling */
      .cheggers::-webkit-scrollbar {
        width: 8px;
      }

      .cheggers::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
      }

      .cheggers::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      .cheggers::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    </style>
  `)
  
  // Initialize TTS cooldown display
  updateTtsCooldownDisplay()
  
  // Initialize words count display
  const wordsCountEl = document.getElementById('words-count')
  if (wordsCountEl && words) {
    const filteredCount = getFilteredWords().length
    wordsCountEl.textContent = `Words collected: ${words.length} (${filteredCount} valid)`
  }
}

getEmotes()

const quickEmoteHolder = document.getElementById('quick-emotes-holder');

if (quickEmoteHolder) {
  quickEmoteHolder.addEventListener('click', e => {
    /**
     * Example src: https://files.kick.com/emotes/3303101/fullsize
     * 
     * Get the emote ID from the src using regex and get the emote object from the emotes array by the id
     */
    const emoteId = e.target.src.match(/emotes\/(\d+)/)[1];
    
    if (!emoteId) return;

    const emote = emotes.find(e => e.id === parseInt(emoteId));

    if (!emote) return;

    /**
     * Overwrite the fetch function to cancel the first next emote message request
     * If within 100ms such a request is cancelled, don't send another emote message.
     * If there was no such request in 100ms (client side rate limit), send the emote message.
     * Then restore the 
     */

    const { fetch: originalFetch } = window;

    const sendMessageFallback = setTimeout(() => {
      sendMessage(`[emote:${emote.id}:${emote.name}]`);
      e.stopPropagation()
    }, 100)

    window.fetch = async (...args) => {
        let [resource, config] = args;

        // request interceptor starts
        if (resource.includes('https://kick.com/api/v2/messages/send/')) {
            clearTimeout(sendMessageFallback);
        }
        // request interceptor ends

        const response = await originalFetch(resource, config);
        
        window.fetch = originalFetch;

        // response interceptor here
        return response;
    };
  })
}

const sendMessage = message => {
  // Check if it's a TTS message and start cooldown
  if (message.trim().startsWith('!')) {
    ttsCooldownEndTime = Date.now() + ttsCooldownDuration
    updateTtsCooldownDisplay()
  }
  
  fetch(`https://kick.com/api/v2/messages/send/${kickChannelId}`, {
    headers: {
      authorization: auth,
      cluster: 'v2',
      'content-type': 'application/json',
    },
    body: `{"content":"${message}","type":"message"}`,
    method: 'POST',
  })
}

// Function to fill Kick's message input
const fillKickMessageInput = (message) => {
  const messageInput = document.querySelector('[data-testid="chat-input"]')
  if (!messageInput) {
    console.warn('Kick message input not found')
    return false
  }
  
  // Focus the input first
  messageInput.focus()
  
  // Try to set text content directly
  messageInput.textContent = message
  
  // Also try innerHTML for Lexical editor
  const paragraph = messageInput.querySelector('.editor-paragraph')
  if (paragraph) {
    paragraph.textContent = message
  } else {
    messageInput.innerHTML = `<p class="editor-paragraph">${message}</p>`
  }
  
  // Trigger various events to make Kick recognize the change
  const events = ['input', 'change', 'keyup', 'keydown', 'paste']
  events.forEach(eventType => {
    messageInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }))
  })
  
  // Try to trigger Lexical update if available
  if (window.LexicalEditor && messageInput.__lexicalEditor) {
    const editor = messageInput.__lexicalEditor
    editor.update(() => {
      const root = editor.getRootElement()
      if (root) {
        root.textContent = message
      }
    })
  }
  
  return true
}

// Track if we've already intercepted to avoid multiple listeners
let messageBoxIntercepted = false

// Intercept Kick's send button
const interceptKickMessageBox = () => {
  if (messageBoxIntercepted) return
  
  const sendButton = document.getElementById('send-message-button')
  const messageInput = document.querySelector('[data-testid="chat-input"]')
  
  if (!sendButton || !messageInput) {
    // Retry after a short delay if elements aren't ready
    setTimeout(interceptKickMessageBox, 500)
    return
  }
  
  // Mark as intercepted
  messageBoxIntercepted = true
  
  // Initialize placeholder update
  updateTtsCooldownDisplay()
  
  // Function to check TTS cooldown before sending
  const checkTtsCooldown = (e) => {
    const currentContent = messageInput.textContent || messageInput.innerText || ''
    
    // Check if it's a TTS message
    if (currentContent.trim().startsWith('!')) {
      // Check cooldown
      const timeRemaining = ttsCooldownEndTime - Date.now()
      if (timeRemaining > 0) {
        if (e) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }
        alert(`TTS cooldown active. Please wait ${Math.ceil(timeRemaining / 1000)} seconds.`)
        return false
      } else {
        // Message is being sent, update cooldown
        ttsCooldownEndTime = Date.now() + ttsCooldownDuration
        updateTtsCooldownDisplay()
      }
    }
    return true
  }
  
  // Override send button click using capture phase to intercept early
  sendButton.addEventListener('click', checkTtsCooldown, true)
  
  // Also intercept Enter key in the message input
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!checkTtsCooldown(e)) {
        return
      }
    }
  }, true)
  
  console.log('Kick message box intercepted successfully')
}

// Start intercepting when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', interceptKickMessageBox)
} else {
  interceptKickMessageBox()
}

// Also try to intercept after delays in case elements load later
setTimeout(interceptKickMessageBox, 1000)
setTimeout(interceptKickMessageBox, 3000)
setTimeout(interceptKickMessageBox, 5000)

// Periodically try to find and update the placeholder (in case it loads later)
setInterval(() => {
  const timeRemaining = ttsCooldownEndTime - Date.now()
  if (timeRemaining > 0) {
    const kickPlaceholder = findKickPlaceholder()
    if (kickPlaceholder) {
      const seconds = Math.ceil(timeRemaining / 1000)
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      kickPlaceholder.textContent = `TTS Cooldown: ${minutes}:${secs.toString().padStart(2, '0')}`
      kickPlaceholder.style.color = '#ff6464'
    }
  } else {
    const kickPlaceholder = findKickPlaceholder()
    if (kickPlaceholder && kickPlaceholder.textContent.includes('TTS Cooldown')) {
      kickPlaceholder.textContent = 'Send a message'
      kickPlaceholder.style.color = ''
    }
  }
}, 2000)

const emoteFlashbang = () => {
  if (document.getElementById('selectedemote').value === '') {
    alert('Please select an emote')
    return
  }

  if (
    emotes.find(
      e => e.name === document.getElementById('selectedemote').value
    ) === undefined
  ) {
    alert('Invalid emote')
    return
  }

  if (document.getElementById('emoteamount').value === '') {
    alert('Please enter an amount')
    return
  }

  if (document.getElementById('messageamount').value === '') {
    alert('Please enter an amount')
    return
  }

  const selectedEmote = document.getElementById('selectedemote').value

  const emote = emotes.find(e => e.name === selectedEmote)

  const emoteText = `[emote:${emote.id}:${emote.name}] `

  const emoteAmount = document.getElementById('emoteamount').value

  const messageAmount = document.getElementById('messageamount').value

  for (let i = 0; i < messageAmount; i++) {
    sendMessage(emoteText.repeat(emoteAmount))
    console.log(emoteText.repeat(emoteAmount))
  }
}

// function onlyUnique(value, index, array) {
//   return array.indexOf(value) === index
// }

let words = []

const collectWords = data => {
  if (
    data.content.match(/emote:/gm) === null &&
    data.sender.username !== username
  ) {
    // Grab words from data.content as array and add to words with current timestamp per word

    const w = data.content.trim().split(/\s+/)

    if (w.length) {
      words = [...words, ...w.map(word => [Date.now(), word])]
    }
  }
}

const p = ['!', '?', '.']

// Helper function to get filtered words
const getFilteredWords = () => {
  if (!words || words.length === 0) return []
  
  return words
    .map(w => w[1])
    .filter(w => w && typeof w === 'string')
    .filter(w => w.match(/^\!/gm) === null)
    .filter(w => w.match(/^v=/gm) === null)
    .filter(w => w.match(/"/gm) === null)
    .filter(w => w.match(/^\(/gm) === null)
    .filter(w => w.match(/\d+s\.$/gm) === null)
    .filter(w => w.match(/\d+m$/gm) === null)
    .filter(w => w.match(/\)$/gm) === null)
    .filter(w => w.match(/^#/gm) === null)
    .filter(w => w.match(/^@/gm) === null)
}

const sendRandomTts = () => {
  console.log('words: ', words)

  if (words.length < 10) {
    alert('Not enough words collected yet')
    return
  }

  const recentWords = words.filter(w => w[0] >= Date.now() - 120000)
  console.log('filtered: ', recentWords)

  let onlyWords = getFilteredWords()

  if (onlyWords.length === 0) {
    alert('No valid words available after filtering')
    return
  }

  if (voices.length === 0) {
    alert('Please select at least one TTS voice')
    return
  }

  const shuffled = onlyWords.sort(() => 0.5 - Math.random())
  const wordCount = Math.round(Math.random() * 20 + 20)
  const selected = shuffled.slice(0, Math.min(wordCount, shuffled.length))

  const voice = voices[Math.floor(Math.random() * voices.length)]

  const message = `!${voice} ${selected.join(' ')}${
    p[Math.floor(Math.random() * p.length)]
  }`

  console.log(message)

  // Store the message for sending
  currentTtsMessage = message

  // Preview in Kick's message input
  fillKickMessageInput(message)
  
  // Update preview display
  updateTtsPreviewInfo(selected, voice, message)
  
  // Show the Send button
  const sendBtn = document.getElementById('send-tts-btn')
  if (sendBtn) {
    sendBtn.style.display = 'block'
  }
}

// Send the current TTS message
const sendTtsMessage = () => {
  if (!currentTtsMessage) {
    alert('No TTS message to send. Please generate one first.')
    return
  }
  
  // Check cooldown
  const timeRemaining = ttsCooldownEndTime - Date.now()
  if (timeRemaining > 0) {
    alert(`TTS cooldown active. Please wait ${Math.ceil(timeRemaining / 1000)} seconds.`)
    return
  }
  
  // Send the message
  sendMessage(currentTtsMessage)
  
  // Hide the Send button
  const sendBtn = document.getElementById('send-tts-btn')
  if (sendBtn) {
    sendBtn.style.display = 'none'
  }
  
  // Clear the preview
  currentTtsMessage = ''
  const infoDiv = document.getElementById('tts-preview-info')
  if (infoDiv) {
    infoDiv.innerHTML = '<div class="tts-info-placeholder">Generate a TTS message to see preview</div>'
  }
}

// Update TTS preview information display
const updateTtsPreviewInfo = (selectedWords, voice, message) => {
  const infoDiv = document.getElementById('tts-preview-info')
  if (!infoDiv) return
  
  const uniqueWords = [...new Set(selectedWords)]
  const wordCount = selectedWords.length
  
  // Escape HTML to prevent XSS and show full message
  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  infoDiv.innerHTML = `
    <div class="tts-info-header">TTS Preview</div>
    <div class="tts-info-row">
      <span class="tts-info-label">Voice:</span>
      <span class="tts-info-value">${escapeHtml(voice)}</span>
    </div>
    <div class="tts-info-row">
      <span class="tts-info-label">Words:</span>
      <span class="tts-info-value">${wordCount} (${uniqueWords.length} unique)</span>
    </div>
    <div class="tts-info-row" style="flex-direction: column; align-items: flex-start; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
      <span class="tts-info-label" style="margin-bottom: 8px; font-size: 14px;">Message:</span>
      <span class="tts-info-value tts-message-preview">${escapeHtml(message)}</span>
    </div>
  `
}

// Find Kick message box placeholder
const findKickPlaceholder = () => {
  // Find the message input container
  const messageInput = document.querySelector('[data-testid="chat-input"]')
  if (!messageInput) return null
  
  // Look for the placeholder div in the relative container
  const container = messageInput.closest('.relative') || messageInput.parentElement
  if (!container) return null
  
  // Use the exact selector: div with pointer-events-none and absolute classes
  const placeholder = container.querySelector('div.pointer-events-none.absolute')
  
  // Verify it's the right one by checking if it contains "Send" or "message" or "TTS Cooldown"
  if (placeholder && (
    placeholder.textContent.includes('Send') || 
    placeholder.textContent.includes('message') ||
    placeholder.textContent.includes('TTS Cooldown')
  )) {
    return placeholder
  }
  
  // Fallback: search by text content
  const placeholderByText = Array.from(container.querySelectorAll('div')).find(
    el => el.textContent.trim() === 'Send a message' || el.textContent.includes('TTS Cooldown')
  )
  return placeholderByText || null
}

// Update TTS cooldown display
const updateTtsCooldownDisplay = () => {
  const cooldownDiv = document.getElementById('tts-cooldown')
  const kickPlaceholder = findKickPlaceholder()
  
  const updateTimer = () => {
    const timeRemaining = ttsCooldownEndTime - Date.now()
    
    if (timeRemaining > 0) {
      const seconds = Math.ceil(timeRemaining / 1000)
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      const cooldownText = `TTS Cooldown: ${minutes}:${secs.toString().padStart(2, '0')}`
      
      // Update overlay cooldown display
      if (cooldownDiv) {
        cooldownDiv.textContent = cooldownText
        cooldownDiv.classList.add('active')
      }
      
      // Update Kick message box placeholder
      if (kickPlaceholder) {
        kickPlaceholder.textContent = cooldownText
        // Make it more visible during cooldown
        kickPlaceholder.style.color = '#ff6464'
      }
      
      setTimeout(updateTimer, 1000)
    } else {
      // Update overlay cooldown display
      if (cooldownDiv) {
        cooldownDiv.textContent = 'TTS Ready'
        cooldownDiv.classList.remove('active')
      }
      
      // Restore Kick message box placeholder
      if (kickPlaceholder) {
        kickPlaceholder.textContent = 'Send a message'
        kickPlaceholder.style.color = ''
      }
    }
  }
  
  updateTimer()
}

setInterval(() => {
  words = words.filter(w => w[0] >= Date.now() - 200000)

  // Update words count display
  const wordsCountEl = document.getElementById('words-count')
  if (wordsCountEl) {
    const filteredCount = getFilteredWords().length
    wordsCountEl.textContent = `Words collected: ${words.length} (${filteredCount} valid)`
  }

  console.log(
    words
      .map(w => w[1])
      // .filter(onlyUnique)
      .filter(w => w.match(/^\!/gm) === null)
      .filter(w => w.match(/^v=/gm) === null)
      .filter(w => w.match(/"/gm) === null)
      .filter(w => w.match(/^\(/gm) === null)
      .filter(w => w.match(/\d+s\.$/gm) === null)
      .filter(w => w.match(/\d+m$/gm) === null)
      .filter(w => w.match(/\)$/gm) === null)
      .filter(w => w.match(/^#/gm) === null)
      .filter(w => w.match(/^@/gm) === null)
  )
}, 10000)

channel.bind(messageEvent, collectWords)
