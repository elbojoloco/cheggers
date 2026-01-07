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

// ============================================================================
// LocalStorage Repository Pattern
// ============================================================================
const StorageRepo = {
  // Generic get/set helpers
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e)
      return defaultValue
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (e) {
      console.error(`Error writing ${key} to localStorage:`, e)
      return false
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (e) {
      console.error(`Error removing ${key} from localStorage:`, e)
      return false
    }
  },
  
  // Specific data accessors
  getConfig: () => StorageRepo.get('cheggers_config', {
    selectedVoice: 'snape',
    maxWords: 32,
    randomTtsCollapsed: false,
    emoteSpamCollapsed: false,
    ttsLibraryCollapsed: false,
    ttsHistoryCollapsed: false,
    srHistoryCollapsed: false
  }),
  
  setConfig: (config) => StorageRepo.set('cheggers_config', config),
  
  getSavedMessages: () => StorageRepo.get('cheggers_saved_messages', []),
  
  setSavedMessages: (messages) => StorageRepo.set('cheggers_saved_messages', messages),
  
  getTtsHistory: () => StorageRepo.get('cheggers_tts_history', []),
  
  addTtsHistory: (message) => {
    const history = StorageRepo.getTtsHistory()
    // Add timestamp and limit to last 100
    history.unshift({ message, timestamp: Date.now() })
    StorageRepo.set('cheggers_tts_history', history.slice(0, 100))
  },
  
  getSrHistory: () => StorageRepo.get('cheggers_sr_history', []),
  
  addSrHistory: (message) => {
    const history = StorageRepo.getSrHistory()
    // Add timestamp and limit to last 100
    history.unshift({ message, timestamp: Date.now() })
    StorageRepo.set('cheggers_sr_history', history.slice(0, 100))
  },
  
  getLastTtsTimestamp: () => StorageRepo.get('cheggers_last_tts_timestamp', 0),
  
  setLastTtsTimestamp: (timestamp) => StorageRepo.set('cheggers_last_tts_timestamp', timestamp),
  
  getLastSrTimestamp: () => StorageRepo.get('cheggers_last_sr_timestamp', 0),
  
  setLastSrTimestamp: (timestamp) => StorageRepo.set('cheggers_last_sr_timestamp', timestamp)
}

// ============================================================================
// State Management
// ============================================================================
// Load config from localStorage
const config = StorageRepo.getConfig()
let selectedVoice = config.selectedVoice || 'snape'
let autoSendTts = false // Always false on initialization, not stored
let maxWords = config.maxWords || 32
let randomTtsCollapsed = config.randomTtsCollapsed || false
let emoteSpamCollapsed = config.emoteSpamCollapsed || false
let ttsLibraryCollapsed = config.ttsLibraryCollapsed || false
let ttsHistoryCollapsed = config.ttsHistoryCollapsed || false
let srHistoryCollapsed = config.srHistoryCollapsed || false

// Saved messages management
let savedMessages = StorageRepo.getSavedMessages() // Array of {id, message, autoSend}
let autoSendMessageId = null // ID of message set to auto-send

// TTS cooldown tracking
const ttsCooldownDuration = 120000 // 2 minutes in milliseconds
const ttsCooldownGracePeriod = 3000 // 3 seconds grace period
// Load last TTS timestamp and calculate cooldown end time
const lastTtsTimestamp = StorageRepo.getLastTtsTimestamp()
let ttsCooldownEndTime = lastTtsTimestamp > 0 ? lastTtsTimestamp + ttsCooldownDuration : 0

// Song request cooldown tracking
const srCooldownDuration = 900000 // 15 minutes in milliseconds
// Load last SR timestamp and calculate cooldown end time
const lastSrTimestamp = StorageRepo.getLastSrTimestamp()
let srCooldownEndTime = lastSrTimestamp > 0 ? lastSrTimestamp + srCooldownDuration : 0

// Current TTS message to send
let currentTtsMessage = ''

// Minimize state
let isMinimized = false

// Auto-send TTS state
let autoSendCheckInProgress = false

// Words collection for TTS
let words = []

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

let activeEmote = null

const handleEmoteSearch = () => {
  const searchInput = document.getElementById('selectedemote')
  const searchValue = searchInput.value.toLowerCase().trim()
  const resultsContainer = document.getElementById('emote-search-results')
  
  if (!resultsContainer) return
  
  // Filter emotes based on search (show all if empty)
  const matchingEmotes = searchValue === '' 
    ? emotes 
    : emotes.filter(emote => emote.name.toLowerCase().includes(searchValue))
  
  // Check if search exactly matches an emote name
  const exactMatch = emotes.find(e => e.name.toLowerCase() === searchValue)
  activeEmote = exactMatch || null
  
  // Display matching emotes (always show, even when empty)
  resultsContainer.innerHTML = matchingEmotes
    .slice(0, 20) // Limit to 20 results for performance
    .map(emote => `
      <div class="emote-search-item ${activeEmote && activeEmote.name === emote.name ? 'active' : ''}" 
           onclick="selectEmote('${emote.name}')">
        <img src="${emote.image}" alt="${emote.name}" class="emote-search-item-img" />
        <span class="emote-search-item-name">${emote.name}</span>
      </div>
    `).join('')
  
  if (matchingEmotes.length > 0) {
    resultsContainer.classList.add('show')
  } else {
    resultsContainer.classList.remove('show')
  }
}

const selectEmote = (emoteName) => {
  const searchInput = document.getElementById('selectedemote')
  searchInput.value = emoteName
  handleEmoteSearch()
}

const updateEmotePreviewSrc = () => {
  handleEmoteSearch()
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

// Toggle section collapse
const toggleSection = (sectionName) => {
  let collapsed = false
  const contentId = sectionName === 'randomTts' ? 'random-tts-content' :
                    sectionName === 'emoteSpam' ? 'emote-spam-content' :
                    sectionName === 'ttsLibrary' ? 'tts-library-content' :
                    sectionName === 'ttsHistory' ? 'tts-history-content' :
                    'sr-history-content'
  
  const content = document.getElementById(contentId)
  const header = content?.closest('.collapsible-section')?.querySelector('.section-header')
  const icon = header?.querySelector('.collapse-icon')
  
  if (sectionName === 'randomTts') {
    randomTtsCollapsed = !randomTtsCollapsed
    collapsed = randomTtsCollapsed
  } else if (sectionName === 'emoteSpam') {
    emoteSpamCollapsed = !emoteSpamCollapsed
    collapsed = emoteSpamCollapsed
  } else if (sectionName === 'ttsLibrary') {
    ttsLibraryCollapsed = !ttsLibraryCollapsed
    collapsed = ttsLibraryCollapsed
  } else if (sectionName === 'ttsHistory') {
    ttsHistoryCollapsed = !ttsHistoryCollapsed
    collapsed = ttsHistoryCollapsed
  } else if (sectionName === 'srHistory') {
    srHistoryCollapsed = !srHistoryCollapsed
    collapsed = srHistoryCollapsed
  }
  
  saveConfig()
  
  if (content) {
    if (collapsed) {
      content.classList.add('collapsed')
      if (icon) icon.textContent = '▶'
    } else {
      content.classList.remove('collapsed')
      if (icon) icon.textContent = '▼'
    }
  }
}

// Close TTS preview
const closeTtsPreview = () => {
  const preview = document.getElementById('tts-preview-info')
  if (preview) {
    preview.style.display = 'none'
  }
  const sendBtn = document.getElementById('send-tts-btn')
  if (sendBtn) {
    sendBtn.style.display = 'none'
  }
  currentTtsMessage = ''
}

// Save config to localStorage (autoSendTts is not stored)
const saveConfig = () => {
  StorageRepo.setConfig({
    selectedVoice,
    maxWords,
    randomTtsCollapsed,
    emoteSpamCollapsed,
    ttsLibraryCollapsed,
    ttsHistoryCollapsed,
    srHistoryCollapsed
  })
}

// Toggle auto-send
const toggleAutoSend = () => {
  autoSendTts = document.getElementById('auto-send-toggle').checked
  saveConfig()
  
  // Disable saved message auto-send if enabling random TTS
  if (autoSendTts && autoSendMessageId) {
    toggleSavedMessageAutoSend(autoSendMessageId)
  }
  
  // If enabling, check if we should send immediately
  if (autoSendTts && !autoSendMessageId) {
    checkAndAutoSendTts()
  }
}

// Update max words
const updateMaxWords = (value) => {
  maxWords = parseInt(value)
  saveConfig()
  const valueDisplay = document.getElementById('max-words-value')
  if (valueDisplay) {
    valueDisplay.textContent = maxWords
  }
  
  // Live-generate TTS preview on change
  if (words.length >= 10) {
    generateTtsPreview()
  }
}

// Generate TTS preview (without sending)
const generateTtsPreview = () => {
  const onlyWords = getFilteredWords()
  
  if (onlyWords.length === 0) {
    return
  }
  
  if (!selectedVoice) {
    return
  }
  
  const shuffled = onlyWords.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, Math.min(maxWords, shuffled.length))
  const selectedWithoutUrls = selected.filter(w => !containsUrl(w))
  
  if (selectedWithoutUrls.length === 0) {
    return
  }
  
  const voice = selectedVoice === 'random' 
    ? availableVoices[Math.floor(Math.random() * availableVoices.length)]
    : selectedVoice
  
  const message = `!${voice} ${selectedWithoutUrls.join(' ')}${
    p[Math.floor(Math.random() * p.length)]
  }`
  
  // Store the message for sending
  currentTtsMessage = message
  
  // Preview in Kick's message input
  fillKickMessageInput(message)
  
  // Update preview display
  updateTtsPreviewInfo(selectedWithoutUrls, voice, message)
  
  // Show the Send button
  const sendBtn = document.getElementById('send-tts-btn')
  if (sendBtn) {
    sendBtn.style.display = 'block'
  }
}

// Check and auto-send TTS if cooldown is over
const checkAndAutoSendTts = () => {
  if (autoSendCheckInProgress) return
  
  // Check if we have a saved message set to auto-send
  if (autoSendMessageId) {
    const savedMsg = savedMessages.find(m => m.id === autoSendMessageId)
    if (savedMsg) {
      const timeRemaining = ttsCooldownEndTime - Date.now()
      if (timeRemaining > -ttsCooldownGracePeriod) {
        // Wait for grace period
        setTimeout(checkAndAutoSendTts, Math.max(0, timeRemaining + ttsCooldownGracePeriod + 100))
        return
      }
      
      autoSendCheckInProgress = true
      sendMessage(savedMsg.message)
      autoSendCheckInProgress = false
      setTimeout(checkAndAutoSendTts, ttsCooldownDuration + ttsCooldownGracePeriod + 100)
      return
    }
  }
  
  // Otherwise check random TTS auto-send
  if (!autoSendTts) return
  
  const timeRemaining = ttsCooldownEndTime - Date.now()
  if (timeRemaining > -ttsCooldownGracePeriod) {
    // Wait for grace period
    setTimeout(checkAndAutoSendTts, Math.max(0, timeRemaining + ttsCooldownGracePeriod + 100))
    return
  }
  
  autoSendCheckInProgress = true
  
  // Cooldown is over (with grace period), generate and send
  const onlyWords = getFilteredWords()
  if (onlyWords.length >= 10) {
    sendRandomTts()
    // Send immediately if we have a message
    if (currentTtsMessage) {
      setTimeout(() => {
        sendTtsMessage()
        autoSendCheckInProgress = false
        // After sending, check again after cooldown duration + grace period
        setTimeout(checkAndAutoSendTts, ttsCooldownDuration + ttsCooldownGracePeriod + 100)
      }, 500)
      return
    }
  }
  
  autoSendCheckInProgress = false
  // If we couldn't send, check again in a bit
  setTimeout(checkAndAutoSendTts, 5000)
}

// Toggle voice radio button
const selectVoice = (voiceName) => {
  selectedVoice = voiceName
  saveConfig()
  
  // Update all radio buttons and their visual states
  availableVoices.forEach(voice => {
    const radioBtn = document.getElementById(`voice-${voice}`)
    if (radioBtn) {
      radioBtn.checked = (voice === voiceName)
      // Find the label that contains this radio button
      const label = radioBtn.closest('.voice-radio-label')
      if (label) {
        const buttonSpan = label.querySelector('.voice-radio-button')
        if (buttonSpan) {
          if (voice === voiceName) {
            buttonSpan.classList.add('active')
          } else {
            buttonSpan.classList.remove('active')
          }
        }
      }
    }
  })
  
  // Update Random radio button
  const randomRadio = document.getElementById('voice-random')
  if (randomRadio) {
    randomRadio.checked = (voiceName === 'random')
    const randomLabel = randomRadio.closest('.voice-radio-label')
    if (randomLabel) {
      const randomButtonSpan = randomLabel.querySelector('.voice-radio-button')
      if (randomButtonSpan) {
        if (voiceName === 'random') {
          randomButtonSpan.classList.add('active')
        } else {
          randomButtonSpan.classList.remove('active')
        }
      }
    }
  }
  
  console.log('Voice selected:', selectedVoice)
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
        <div id="cooldown-display" class="cooldown-display">
          <div id="tts-cooldown" class="tts-cooldown" onclick="event.stopPropagation(); if (isMinimized) toggleMinimize();">TTS Ready</div>
          <div id="sr-cooldown" class="sr-cooldown" style="display: none;" onclick="event.stopPropagation(); if (isMinimized) toggleMinimize();">SR Ready</div>
        </div>
      </div>

      <div id="cheggers-content" class="cheggers-content">
        <div class="cheggers-section collapsible-section">
          <div class="section-header" onclick="toggleSection('randomTts')">
            <h2 class="section-title">Random TTS</h2>
            <span class="collapse-icon">${randomTtsCollapsed ? '▶' : '▼'}</span>
          </div>
          <div id="random-tts-content" class="section-content ${randomTtsCollapsed ? 'collapsed' : ''}">
          <div class="cheggers-section-inner">
            <label class="cheggers-label">TTS Voices</label>
            <div class="voices-radio-container">
                <label class="voice-radio-label">
                  <input 
                    type="radio" 
                    id="voice-random" 
                    name="tts-voice" 
                    class="voice-radio" 
                    ${selectedVoice === 'random' ? 'checked' : ''}
                    onchange="selectVoice('random')"
                  />
                  <span class="voice-radio-button ${selectedVoice === 'random' ? 'active' : ''}">Random</span>
                </label>
                ${availableVoices.map(voice => `
                  <label class="voice-radio-label">
                    <input 
                      type="radio" 
                      id="voice-${voice}" 
                      name="tts-voice" 
                      class="voice-radio" 
                      ${selectedVoice === voice ? 'checked' : ''}
                      onchange="selectVoice('${voice}')"
                    />
                    <span class="voice-radio-button ${selectedVoice === voice ? 'active' : ''}">${voice}</span>
                  </label>
                `).join('')}
            </div>
          </div>
          <div class="auto-send-container">
            <label class="auto-send-label">
              <input type="checkbox" id="auto-send-toggle" ${autoSendTts ? 'checked' : ''} onchange="toggleAutoSend()" />
              <span>Auto-send TTS when cooldown ends</span>
            </label>
          </div>
          <div class="max-words-container">
            <label class="cheggers-label" for="max-words-slider">Max Words: <span id="max-words-value">${maxWords}</span></label>
            <input type="range" id="max-words-slider" min="1" max="32" value="${maxWords}" onInput="updateMaxWords(this.value)" />
          </div>
          <button class="cheggers-btn cheggers-btn-primary" onclick="sendRandomTts()">
            Generate TTS
          </button>
          <div id="tts-preview-info" class="tts-preview-info" style="display: none;">
            <div class="tts-preview-header">
              <span class="tts-preview-title">TTS Preview</span>
              <button class="tts-preview-close" onclick="closeTtsPreview()" title="Close">✕</button>
            </div>
            <div class="tts-preview-content">
              <div class="tts-info-placeholder">Generate a TTS message to see preview</div>
            </div>
          </div>
          <button id="send-tts-btn" class="cheggers-btn cheggers-btn-send" onclick="sendTtsMessage()" style="display: none;">
            Send TTS
          </button>
          <div class="words-stats">
            <span id="words-count">Word list: ${getFilteredWords().length}</span>
          </div>
          </div>
        </div>

        <div class="cheggers-section collapsible-section">
          <div class="section-header" onclick="toggleSection('emoteSpam')">
            <h2 class="section-title">Emote Spam</h2>
            <span class="collapse-icon">${emoteSpamCollapsed ? '▶' : '▼'}</span>
          </div>
          <div id="emote-spam-content" class="section-content ${emoteSpamCollapsed ? 'collapsed' : ''}">
          <label class="cheggers-label" for="selectedemote">Emote to spam</label>
          <input type="text" id="selectedemote" class="cheggers-input" placeholder="Search emotes" value="emojiLol" onInput="handleEmoteSearch()" />
          <div id="emote-search-results" class="emote-search-results show"></div>

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
          <button class="cheggers-btn" onclick="emoteFlashbang()">Emote Flashbang</button>
          </div>
        </div>

        <div class="cheggers-section collapsible-section">
          <div class="section-header" onclick="toggleSection('ttsLibrary')">
            <h2 class="section-title">TTS Library</h2>
            <span class="collapse-icon">${ttsLibraryCollapsed ? '▶' : '▼'}</span>
          </div>
          <div id="tts-library-content" class="section-content ${ttsLibraryCollapsed ? 'collapsed' : ''}">
          <div class="saved-message-add">
            <input type="text" id="new-saved-message" class="cheggers-input" placeholder="Enter TTS message to save" />
            <button class="cheggers-btn" onclick="saveTtsMessage(document.getElementById('new-saved-message').value); document.getElementById('new-saved-message').value = '';">Save</button>
          </div>
          <div id="saved-messages-list" class="saved-messages-list"></div>
          </div>
        </div>

        <div class="cheggers-section collapsible-section">
          <div class="section-header" onclick="toggleSection('ttsHistory')">
            <h2 class="section-title">TTS History</h2>
            <span class="collapse-icon">${ttsHistoryCollapsed ? '▶' : '▼'}</span>
          </div>
          <div id="tts-history-content" class="section-content ${ttsHistoryCollapsed ? 'collapsed' : ''}">
          <div id="tts-history-list" class="history-list"></div>
          </div>
        </div>

        <div class="cheggers-section collapsible-section">
          <div class="section-header" onclick="toggleSection('srHistory')">
            <h2 class="section-title">Song Request History</h2>
            <span class="collapse-icon">${srHistoryCollapsed ? '▶' : '▼'}</span>
          </div>
          <div id="sr-history-content" class="section-content ${srHistoryCollapsed ? 'collapsed' : ''}">
          <div id="sr-history-list" class="history-list"></div>
          </div>
        </div>
      </div>
    </div>
  
    <style>
      .cheggers {
        position: fixed;
        left: 10px;
        bottom: 10px;
        background: #1a1a1a;
        color: #fff;
        padding: 20px;
        z-index: 9999;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        max-width: 350px;
        max-height: 50vh;
        overflow-y: auto;
        border: 1px solid rgba(0, 255, 136, 0.2);
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
        transition: background-color 0.2s ease;
        border-radius: 8px;
        padding: 10px;
        margin: -10px -10px 20px -10px;
      }

      .cheggers-header:hover {
        background-color: rgba(0, 255, 136, 0.1);
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
        color: #00ff88;
      }

      .cooldown-display {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-end;
      }

      .tts-cooldown,
      .sr-cooldown {
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
        cursor: pointer;
      }

      .tts-cooldown:hover,
      .sr-cooldown:hover {
        background: rgba(0, 255, 136, 0.35);
      }

      .tts-cooldown.active,
      .sr-cooldown.active {
        background: rgba(255, 100, 100, 0.3);
        color: #ff6464;
        animation: pulse 2s infinite;
      }
      
      .sr-cooldown {
        background: rgba(0, 204, 255, 0.25);
        color: #00ccff;
      }
      
      .sr-cooldown.active {
        background: rgba(255, 100, 100, 0.3);
        color: #ff6464;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .cheggers-section {
        margin-bottom: 18px;
      }

      .section-title {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 10px 0;
        color: #d0d0d0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tts-preview-info {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 10px;
        margin-top: 10px;
        font-size: 12px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .tts-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .tts-preview-title {
        font-weight: 600;
        color: #00ff88;
        font-size: 14px;
      }

      .tts-preview-close {
        background: rgba(255, 100, 100, 0.15);
        border: 1px solid #ff6464;
        color: #ff6464;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 12px;
        padding: 0;
        transition: all 0.2s ease;
      }

      .tts-preview-close:hover {
        background: rgba(255, 100, 100, 0.25);
      }

      .tts-preview-content {
        font-size: 12px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
        margin-bottom: 10px;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background-color 0.2s ease;
      }

      .section-header:hover {
        background-color: rgba(0, 255, 136, 0.1);
      }

      .section-header .section-title {
        margin-bottom: 0;
      }

      .section-header .collapse-icon {
        font-size: 12px;
        color: #b0b0b0;
        transition: transform 0.2s ease, color 0.2s ease;
      }

      .section-header:hover .collapse-icon {
        color: #00ff88;
      }

      .section-content {
        overflow: hidden;
        transition: max-height 0.3s ease;
        max-height: 2000px;
      }

      .section-content.collapsed {
        max-height: 0;
        overflow: hidden;
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


      .auto-send-container {
        margin-bottom: 12px;
        padding: 8px;
        background-color: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .auto-send-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        color: #e0e0e0;
        transition: color 0.2s ease;
      }

      .auto-send-label:hover {
        color: #fff;
      }

      .auto-send-label input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #00ff88;
      }

      .max-words-container {
        margin-bottom: 12px;
      }

      .max-words-container input[type="range"] {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.5);
        outline: none;
        -webkit-appearance: none;
        margin-top: 8px;
      }

      .max-words-container input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #00ff88;
        cursor: pointer;
        border: 2px solid #1a1a1a;
      }

      .max-words-container input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #00ff88;
        cursor: pointer;
        border: 2px solid #1a1a1a;
      }

      #max-words-value {
        color: #00ff88;
        font-weight: 600;
      }

      .cheggers-btn-small {
        flex-shrink: 0;
        width: auto;
        min-width: 40px;
        padding: 10px 12px;
        margin-bottom: 0;
      }

      .voices-radio-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .voice-radio-label {
        display: inline-flex;
        cursor: pointer;
        user-select: none;
      }

      .voice-radio {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }

      .voice-radio-button {
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

      .voice-radio-button:hover {
        background-color: rgba(0, 0, 0, 0.6);
        border-color: rgba(0, 255, 136, 0.4);
        color: #fff;
      }

      .voice-radio:checked + .voice-radio-button,
      .voice-radio-button.active {
        background-color: rgba(0, 255, 136, 0.2);
        color: #00ff88;
        border-color: #00ff88;
        font-weight: 600;
      }

      .voice-radio:focus + .voice-radio-button {
        outline: 2px solid #00ff88;
        outline-offset: 2px;
      }

      .words-stats {
        font-size: 11px;
        color: #b0b0b0;
        margin-top: 8px;
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
        height: 50px;
        border-radius: 6px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.3);
        padding: 4px;
      }

      .cheggers-label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 500;
        color: #e0e0e0;
      }

      .cheggers-input {
        display: block;
        width: 100%;
        margin-bottom: 10px;
        padding: 8px 10px;
        background-color: rgba(0, 0, 0, 0.5);
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        font-size: 13px;
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
        margin-bottom: 10px;
        padding: 10px 12px;
        background-color: rgba(0, 255, 136, 0.15);
        color: #00ff88;
        border: 2px solid #00ff88;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 255, 136, 0.2);
      }

      .cheggers-btn:hover {
        transform: translateY(-2px);
        background-color: rgba(0, 255, 136, 0.25);
        box-shadow: 0 6px 16px rgba(0, 255, 136, 0.3);
      }

      .cheggers-btn:active {
        transform: translateY(0);
      }

      .cheggers-btn-primary {
        background-color: rgba(255, 100, 100, 0.15);
        border-color: #ff6464;
        color: #ff6464;
        box-shadow: 0 4px 12px rgba(255, 100, 100, 0.2);
      }

      .cheggers-btn-primary:hover {
        background-color: rgba(255, 100, 100, 0.25);
        box-shadow: 0 6px 16px rgba(255, 100, 100, 0.3);
      }

      .cheggers-btn-send {
        background-color: rgba(0, 204, 255, 0.15);
        border-color: #00ccff;
        color: #00ccff;
        box-shadow: 0 4px 12px rgba(0, 204, 255, 0.2);
      }

      .cheggers-btn-send:hover {
        background-color: rgba(0, 204, 255, 0.25);
        box-shadow: 0 6px 16px rgba(0, 204, 255, 0.3);
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

      .emote-search-results {
        max-height: 200px;
        overflow-y: auto;
        background-color: rgba(0, 0, 0, 0.6);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        margin-bottom: 12px;
        padding: 8px;
        gap: 8px;
        display: none;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }

      .emote-search-results.show {
        display: grid;
      }

      .emote-search-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px;
        cursor: pointer;
        border-radius: 6px;
        border: 2px solid transparent;
        transition: all 0.2s ease;
        background-color: rgba(0, 0, 0, 0.3);
      }

      .emote-search-item:hover {
        background-color: rgba(0, 255, 136, 0.1);
        border-color: rgba(0, 255, 136, 0.3);
      }

      .emote-search-item.active {
        background-color: rgba(0, 255, 136, 0.2);
        border-color: #00ff88;
      }

      .emote-search-item-img {
        width: 48px;
        height: 48px;
        object-fit: contain;
        margin-bottom: 4px;
      }

      .emote-search-item-name {
        font-size: 11px;
        color: #e0e0e0;
        text-align: center;
        word-break: break-word;
        max-width: 100%;
      }

      .emote-search-item.active .emote-search-item-name {
        color: #00ff88;
        font-weight: 600;
      }

      .saved-message-add {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }

      .saved-message-add input {
        flex: 1;
        margin-bottom: 0;
      }

      .saved-message-add button {
        width: auto;
        min-width: 60px;
        margin-bottom: 0;
      }

      .saved-messages-list,
      .history-list {
        max-height: 200px;
        overflow-y: auto;
      }

      .saved-message-item {
        background-color: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 8px;
      }

      .saved-message-content {
        margin-bottom: 8px;
      }

      .saved-message-input {
        width: 100%;
        margin-bottom: 0;
        font-size: 12px;
        padding: 6px 8px;
        background-color: rgba(0, 0, 0, 0.5);
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.2);
      }

      .saved-message-input:focus {
        outline: 2px solid #00ff88;
        outline-offset: 2px;
        border-color: #00ff88;
        background-color: rgba(0, 0, 0, 0.7);
      }

      .saved-message-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .saved-message-btn {
        width: auto;
        min-width: 50px;
        padding: 6px 10px;
        margin-bottom: 0;
        font-size: 11px;
        transition: all 0.2s ease;
      }

      .saved-message-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 255, 136, 0.2);
      }

      .saved-message-btn.active {
        background-color: rgba(0, 255, 136, 0.3);
        border-color: #00ff88;
        color: #00ff88;
      }

      .saved-message-btn.active:hover {
        background-color: rgba(0, 255, 136, 0.4);
        box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);
      }

      .saved-message-btn.combo-btn {
        background-color: rgba(255, 100, 100, 0.15);
        border-color: #ff6464;
        color: #ff6464;
      }

      .saved-message-btn.combo-btn:hover {
        background-color: rgba(255, 100, 100, 0.25);
        box-shadow: 0 2px 8px rgba(255, 100, 100, 0.2);
      }

      .saved-message-btn.delete-btn {
        background-color: rgba(255, 100, 100, 0.15);
        border-color: #ff6464;
        color: #ff6464;
        min-width: 30px;
        padding: 6px;
      }

      .saved-message-btn.delete-btn:hover {
        background-color: rgba(255, 100, 100, 0.25);
        box-shadow: 0 2px 8px rgba(255, 100, 100, 0.2);
      }

      .history-item {
        background-color: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .history-message {
        flex: 1;
        font-size: 11px;
        color: #e0e0e0;
        word-break: break-word;
        overflow-wrap: break-word;
      }

      .history-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }

      .history-btn {
        width: auto;
        min-width: 50px;
        padding: 6px 10px;
        margin-bottom: 0;
        font-size: 11px;
        transition: all 0.2s ease;
      }

      .history-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 255, 136, 0.2);
      }

      .empty-state {
        text-align: center;
        color: #999;
        font-size: 12px;
        font-style: italic;
        padding: 20px;
      }
    </style>
  `)
  
  // Initialize cooldown display
  updateCooldownDisplay()
  
  // Initialize words count display
  const wordsCountEl = document.getElementById('words-count')
  if (wordsCountEl) {
    const filteredCount = getFilteredWords().length
    wordsCountEl.textContent = `Word list: ${filteredCount}`
  }
  
  // Initialize saved messages and history
  renderSavedMessages()
  renderTtsHistory()
  renderSrHistory()
  
  // Find auto-send message ID
  const autoSendMsg = savedMessages.find(m => m.autoSend)
  if (autoSendMsg) {
    autoSendMessageId = autoSendMsg.id
  }
  
  // Start auto-send check if enabled
  if (autoSendTts || autoSendMessageId) {
    checkAndAutoSendTts()
  }
  
  // Initialize emote search with default value and show results
  const selectedEmoteInput = document.getElementById('selectedemote')
  if (selectedEmoteInput) {
    const defaultEmote = emotes.find(e => e.name === 'emojiLol')
    if (defaultEmote) {
      activeEmote = defaultEmote
    }
    // Show all emotes by default
    handleEmoteSearch()
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

// Helper function to check if a message is a TTS message
const isTtsMessage = (message) => {
  const trimmed = message.trim()
  if (!trimmed.startsWith('!')) return false
  
  // Extract the voice name (everything after ! until first space)
  const voiceMatch = trimmed.match(/^!(\w+)/)
  if (!voiceMatch) return false
  
  const voiceName = voiceMatch[1].toLowerCase()
  return availableVoices.includes(voiceName)
}

// Helper function to check if a message is a song request
const isSongRequest = (message) => {
  const trimmed = message.trim()
  return trimmed.toLowerCase().startsWith('!sr ')
}

const sendMessage = message => {
  const now = Date.now()
  
  // Check if it's a TTS message and start cooldown
  if (isTtsMessage(message)) {
    StorageRepo.setLastTtsTimestamp(now)
    ttsCooldownEndTime = now + ttsCooldownDuration
    updateCooldownDisplay()
    // Add to history if manually sent (not from auto-send)
    // Note: Chatbox sends are handled by updateCooldownsOnSend, not this function
    if (!autoSendCheckInProgress) {
      StorageRepo.addTtsHistory(message)
      renderTtsHistory()
    }
  }
  
  // Check if it's a song request and start cooldown
  if (isSongRequest(message)) {
    StorageRepo.setLastSrTimestamp(now)
    srCooldownEndTime = now + srCooldownDuration
    updateCooldownDisplay()
    // Add to history (chatbox sends are handled by updateCooldownsOnSend)
    StorageRepo.addSrHistory(message)
    renderSrHistory()
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

// Generate unique ID for saved messages
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

// Save a new TTS message
const saveTtsMessage = (message) => {
  if (!message || !message.trim()) {
    alert('Please enter a message')
    return
  }
  
  const newMessage = {
    id: generateId(),
    message: message.trim(),
    autoSend: false
  }
  
  savedMessages.push(newMessage)
  StorageRepo.setSavedMessages(savedMessages)
  renderSavedMessages()
}

// Delete a saved message
const deleteSavedMessage = (id) => {
  savedMessages = savedMessages.filter(m => m.id !== id)
  if (autoSendMessageId === id) {
    autoSendMessageId = null
  }
  StorageRepo.setSavedMessages(savedMessages)
  renderSavedMessages()
}

// Toggle auto-send for a saved message
const toggleSavedMessageAutoSend = (id) => {
  if (autoSendMessageId === id) {
    // Disable auto-send
    autoSendMessageId = null
    savedMessages.forEach(m => m.autoSend = false)
  } else {
    // Enable auto-send for this message, disable others
    autoSendMessageId = id
    savedMessages.forEach(m => {
      m.autoSend = (m.id === id)
    })
    // Disable random TTS auto-send
    autoSendTts = false
    const toggle = document.getElementById('auto-send-toggle')
    if (toggle) toggle.checked = false
    saveConfig()
  }
  
  StorageRepo.setSavedMessages(savedMessages)
  renderSavedMessages()
  
  // Start auto-send check if enabled
  if (autoSendMessageId) {
    checkAndAutoSendTts()
  }
}

// Send a saved message
const sendSavedMessage = (message) => {
  // Unescape the message if needed
  const unescapedMessage = message.replace(/\\'/g, "'").replace(/\\"/g, '"')
  sendMessage(unescapedMessage)
}

// Combo send (send twice with confirmation)
const comboSendSavedMessage = (message) => {
  if (!confirm('⚠️ WARNING: This will send the message TWICE. You might get timed out by moderators. Continue?')) {
    return
  }
  
  // Unescape the message if needed
  const unescapedMessage = message.replace(/\\'/g, "'").replace(/\\"/g, '"')
  sendMessage(unescapedMessage)
  setTimeout(() => {
    sendMessage(unescapedMessage)
  }, 1000) // 1 second delay between sends
}

// Render saved messages section
const renderSavedMessages = () => {
  const container = document.getElementById('saved-messages-list')
  if (!container) return
  
  if (savedMessages.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved messages</div>'
    return
  }
  
  container.innerHTML = savedMessages.map(msg => {
    const escapedMessage = msg.message.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')
    const htmlEscapedMessage = msg.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    return `
    <div class="saved-message-item">
      <div class="saved-message-content">
        <input type="text" class="saved-message-input" value="${htmlEscapedMessage}" 
               onchange="updateSavedMessage('${msg.id}', this.value)" />
      </div>
      <div class="saved-message-actions">
        <button class="saved-message-btn ${msg.autoSend ? 'active' : ''}" 
                onclick="toggleSavedMessageAutoSend('${msg.id}')" 
                title="${msg.autoSend ? 'Disable auto-send' : 'Enable auto-send'}">
          ${msg.autoSend ? '✓ Auto' : 'Auto'}
        </button>
        <button class="saved-message-btn" onclick="sendSavedMessage('${escapedMessage}')" title="Send once">
          Send
        </button>
        <button class="saved-message-btn combo-btn" onclick="comboSendSavedMessage('${escapedMessage}')" title="Send twice (combo)">
          Combo
        </button>
        <button class="saved-message-btn delete-btn" onclick="deleteSavedMessage('${msg.id}')" title="Delete">
          ✕
        </button>
      </div>
    </div>
  `}).join('')
}

// Update saved message
const updateSavedMessage = (id, newMessage) => {
  const msg = savedMessages.find(m => m.id === id)
  if (msg) {
    msg.message = newMessage.trim()
    StorageRepo.setSavedMessages(savedMessages)
  }
}

// Render TTS history
const renderTtsHistory = () => {
  const container = document.getElementById('tts-history-list')
  if (!container) return
  
  const history = StorageRepo.getTtsHistory()
  
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">No TTS history</div>'
    return
  }
  
  container.innerHTML = history.slice(0, 20).map(item => {
    const escapedMessage = item.message.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const htmlEscapedMessage = item.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `
    <div class="history-item">
      <div class="history-message">${htmlEscapedMessage}</div>
      <div class="history-actions">
        <button class="history-btn" onclick="sendSavedMessage('${escapedMessage}')">Send</button>
        <button class="history-btn" onclick="saveTtsMessage('${escapedMessage}')">Save</button>
      </div>
    </div>
  `}).join('')
}

// Render SR history
const renderSrHistory = () => {
  const container = document.getElementById('sr-history-list')
  if (!container) return
  
  const history = StorageRepo.getSrHistory()
  
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">No song request history</div>'
    return
  }
  
  container.innerHTML = history.slice(0, 20).map(item => {
    const escapedMessage = item.message.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const htmlEscapedMessage = item.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `
    <div class="history-item">
      <div class="history-message">${htmlEscapedMessage}</div>
      <div class="history-actions">
        <button class="history-btn" onclick="sendSavedMessage('${escapedMessage}')">Send</button>
      </div>
    </div>
  `}).join('')
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
  
  // Verify it's the right one by checking if it contains "Send" or "message" or cooldown info
  if (placeholder && (
    placeholder.textContent.includes('Send') || 
    placeholder.textContent.includes('message') ||
    placeholder.textContent.includes('TTS') ||
    placeholder.textContent.includes('SR')
  )) {
    return placeholder
  }
  
  // Fallback: search by text content
  const placeholderByText = Array.from(container.querySelectorAll('div')).find(
    el => el.textContent.trim() === 'Send a message' || el.textContent.includes('TTS') || el.textContent.includes('SR')
  )
  return placeholderByText || null
}

// Format time remaining as MM:SS
const formatTimeRemaining = (timeRemaining) => {
  const seconds = Math.ceil(timeRemaining / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Update cooldown display (both TTS and SR)
const updateCooldownDisplay = () => {
  const ttsCooldownDiv = document.getElementById('tts-cooldown')
  const srCooldownDiv = document.getElementById('sr-cooldown')
  const kickPlaceholder = findKickPlaceholder()
  
  const updateTimer = () => {
    const ttsTimeRemaining = ttsCooldownEndTime - Date.now()
    const srTimeRemaining = srCooldownEndTime - Date.now()
    
    // Update TTS cooldown
    if (ttsTimeRemaining > 0) {
      const ttsText = `TTS: ${formatTimeRemaining(ttsTimeRemaining)}`
      if (ttsCooldownDiv) {
        ttsCooldownDiv.textContent = ttsText
        ttsCooldownDiv.classList.add('active')
      }
    } else {
      if (ttsCooldownDiv) {
        ttsCooldownDiv.textContent = 'TTS Ready'
        ttsCooldownDiv.classList.remove('active')
      }
      // Check if we should auto-send when cooldown ends
      // Only check once per second to avoid spam
      if (autoSendTts && ttsTimeRemaining <= 0 && !autoSendCheckInProgress) {
        // Cooldown just ended, trigger auto-send check
        checkAndAutoSendTts()
      }
    }
    
    // Update SR cooldown
    if (srTimeRemaining > 0) {
      const srText = `SR: ${formatTimeRemaining(srTimeRemaining)}`
      if (srCooldownDiv) {
        srCooldownDiv.textContent = srText
        srCooldownDiv.classList.add('active')
        srCooldownDiv.style.display = 'block'
      }
    } else {
      if (srCooldownDiv) {
        srCooldownDiv.textContent = 'SR Ready'
        srCooldownDiv.classList.remove('active')
        srCooldownDiv.style.display = 'none'
      }
    }
    
    // Update Kick message box placeholder with combined cooldown info
    if (kickPlaceholder) {
      const cooldowns = []
      if (ttsTimeRemaining > 0) {
        cooldowns.push(`TTS: ${formatTimeRemaining(ttsTimeRemaining)}`)
      }
      if (srTimeRemaining > 0) {
        cooldowns.push(`SR: ${formatTimeRemaining(srTimeRemaining)}`)
      }
      
      if (cooldowns.length > 0) {
        kickPlaceholder.textContent = cooldowns.join(' | ')
        kickPlaceholder.style.color = '#ff6464'
      } else {
        kickPlaceholder.textContent = 'Send a message'
        kickPlaceholder.style.color = ''
      }
    }
    
    setTimeout(updateTimer, 1000)
  }
  
  updateTimer()
}

// Track if we've already intercepted to avoid multiple listeners
let messageBoxIntercepted = false

// Intercept Kick's send button (just for updating cooldown, not blocking)
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
  updateCooldownDisplay()
  
  // Function to update cooldowns when sending (but don't block)
  const updateCooldownsOnSend = () => {
    const currentContent = messageInput.textContent || messageInput.innerText || ''
    
    if (!currentContent.trim()) return
    
    const now = Date.now()
    
    // Check if it's a TTS message and update cooldown + history
    if (isTtsMessage(currentContent)) {
      StorageRepo.setLastTtsTimestamp(now)
      ttsCooldownEndTime = now + ttsCooldownDuration
      updateCooldownDisplay()
      // Add to history (manually sent from chatbox)
      StorageRepo.addTtsHistory(currentContent.trim())
      renderTtsHistory()
    }
    
    // Check if it's a song request and update cooldown + history
    if (isSongRequest(currentContent)) {
      StorageRepo.setLastSrTimestamp(now)
      srCooldownEndTime = now + srCooldownDuration
      updateCooldownDisplay()
      // Add to history (manually sent from chatbox)
      StorageRepo.addSrHistory(currentContent.trim())
      renderSrHistory()
    }
  }
  
  // Listen for send button click to update cooldown
  sendButton.addEventListener('click', updateCooldownsOnSend, true)
  
  // Also listen for Enter key in the message input
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      updateCooldownsOnSend()
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
  const ttsTimeRemaining = ttsCooldownEndTime - Date.now()
  const srTimeRemaining = srCooldownEndTime - Date.now()
  const kickPlaceholder = findKickPlaceholder()
  
  if (kickPlaceholder) {
    const cooldowns = []
    if (ttsTimeRemaining > 0) {
      cooldowns.push(`TTS: ${formatTimeRemaining(ttsTimeRemaining)}`)
    }
    if (srTimeRemaining > 0) {
      cooldowns.push(`SR: ${formatTimeRemaining(srTimeRemaining)}`)
    }
    
    if (cooldowns.length > 0) {
      kickPlaceholder.textContent = cooldowns.join(' | ')
      kickPlaceholder.style.color = '#ff6464'
    } else {
      kickPlaceholder.textContent = 'Send a message'
      kickPlaceholder.style.color = ''
    }
  }
}, 2000)

  const emoteFlashbang = () => {
  const selectedEmoteName = document.getElementById('selectedemote').value
  
  if (selectedEmoteName === '') {
    alert('Please select an emote')
    return
  }

  if (!activeEmote || activeEmote.name !== selectedEmoteName) {
    alert('Please select a valid emote from the search results')
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

  const emote = activeEmote

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

const collectWords = data => {
  // Exclude messages from KickBot and BotRix
  if (data.sender.username === 'KickBot' || data.sender.username === 'BotRix') {
    return
  }
  
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

// Helper function to check if a word contains a URL
const containsUrl = (word) => {
  const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.gg|\.tv|\.co|\.xyz)/i
  return urlPattern.test(word)
}

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
    .filter(w => !containsUrl(w))
}

const sendRandomTts = () => {
  const onlyWords = getFilteredWords()

  if (onlyWords.length < 10) {
    alert('Not enough valid words collected yet')
    return
  }

  if (!selectedVoice) {
    alert('Please select a TTS voice')
    return
  }

  const shuffled = onlyWords.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, Math.min(maxWords, shuffled.length))

  // Filter out URLs from selected words
  const selectedWithoutUrls = selected.filter(w => !containsUrl(w))
  
  if (selectedWithoutUrls.length === 0) {
    alert('No valid words available after filtering URLs')
    return
  }

  const voice = selectedVoice === 'random' 
    ? availableVoices[Math.floor(Math.random() * availableVoices.length)]
    : selectedVoice

  const message = `!${voice} ${selectedWithoutUrls.join(' ')}${
    p[Math.floor(Math.random() * p.length)]
  }`

  // Store the message for sending
  currentTtsMessage = message

  // Preview in Kick's message input
  fillKickMessageInput(message)
  
  // Update preview display
  updateTtsPreviewInfo(selectedWithoutUrls, voice, message)
  
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
  
  // Don't block, just send (cooldown is displayed but doesn't prevent sending)
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
  
  infoDiv.style.display = 'block'
  infoDiv.innerHTML = `
    <div class="tts-preview-header">
      <span class="tts-preview-title">TTS Preview</span>
      <button class="tts-preview-close" onclick="closeTtsPreview()" title="Close">✕</button>
    </div>
    <div class="tts-preview-content">
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
    </div>
  `
}

setInterval(() => {
  words = words.filter(w => w[0] >= Date.now() - 200000)

  // Update words count display
  const wordsCountEl = document.getElementById('words-count')
  if (wordsCountEl) {
    const filteredCount = getFilteredWords().length
    wordsCountEl.textContent = `Word list: ${filteredCount}`
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
