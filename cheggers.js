const kickChannelId = '1820052'
const pusherAppId = '32cbd69e4b950bf97679'
const pusherCluster = 'us2'
const kickChatroom = `chatrooms.${kickChannelId}.v2`
const messageEvent = 'App\\Events\\ChatMessageEvent'
const emoteMessageRegex = /^\[emote:\d+:[a-zA-Z]+]$/gm
const cheggersEmote = '[emote:2836117:grossgoreCheggers]'

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
      <h1>Cheggers</h1>
  
      <button onclick="() => {}" disabled title="Coming soon">Send random TTS</button>
  
      <div style="
          display: flex;
          align-items: center;
          gap: 10px;
      ">
          <button onclick="emoteFlashbang()">Emote flashbang</button>
          <img id="emotepreview" src="https://files.kick.com/emotes/2836117/fullsize" alt="Cheggers" style="
              width: auto;
              height: 50px;
          ">
      </div>

      <label for="selectedemote">Emote to spam</label>
      <input type="text" id="selectedemote" placeholder="Search emotes" list="emotes" value="grossgoreCheggers" onInput="updateEmotePreviewSrc()" />
      <datalist id="emotes">
        ${emotes
          .map(emote => `<option value="${emote.name}"></option>`)
          .join('')}
      </datalist>

      <label for="emoteamount">Amount per message</label>
      <input type="number" id="emoteamount" placeholder="Amount" value="10" min="1" max="14" />

      <label for="messageamount">Amount of messages</label>
      <input type="number" id="messageamount" placeholder="Amount" value="5" min="1" max="15" />
    </div>
  
    <style>
      .cheggers {
        position: fixed;
        left: 10px;
        bottom: 10px;
        background-color: #000;
        color: #fff;
        padding: 10px;
        z-index: 9999;
      }
  
      .cheggers input {
        display: block;
        margin-bottom: 10px;
        padding: 10px;
        background-color: #fff;
        color: #000;
        border: none;
      }
  
      .cheggers button {
        display: block;
        margin-bottom: 10px;
        margin-top: 10px;
        padding: 10px;
        background-color: #fff;
        color: #000;
        border: none;
      }
  
      .cheggers button:disabled {
        background-color: #ccc;
        color: #000;
        cursor: not-allowed;
      }
    </style>
  `)
}

getEmotes()

const sendMessage = message => {
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
