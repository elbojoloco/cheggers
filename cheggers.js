const kickChannelId = '1820052'
const pusherAppId = '32cbd69e4b950bf97679'
const pusherCluster = 'us2'
const kickChatroom = `chatrooms.${kickChannelId}.v2`
const messageEvent = 'App\\Events\\ChatMessageEvent'
const emoteMessageRegex = /^\[emote:\d+:[a-zA-Z]+]$/gm
const cheggersEmote = '[emote:2836117:grossgoreCheggers]'

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

function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
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

function onlyUnique(value, index, array) {
  return array.indexOf(value) === index
}

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

// const voices = ['arnold', 'phil', 'kermit', 'duke', 'trump', 'spongebob']
const voices = ['elmo', 'spongebob']
const p = ['!', '?', '.']

const sendRandomTts = () => {
  console.log('words: ', words)

  console.log(
    'filtered: ',
    words.filter(w => w[0] >= Date.now() - 120000)
  )

  let onlyWords = words
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

  const shuffled = onlyWords.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, Math.round(Math.random() * 20 + 20))

  const voice = voices[Math.floor(Math.random() * voices.length)]

  const message = `!${voice} ${selected.join(' ')}${
    p[Math.floor(Math.random() * p.length)]
  }`

  console.log(message)

  sendMessage(message)
}

setTimeout(() => {
  sendRandomTts()

  setInterval(sendRandomTts, 75000)
}, 25000)

setInterval(() => {
  words = words.filter(w => w[0] >= Date.now() - 200000)

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

const respondToPoo = data => {
  if (data.content === 'poo' || data.content === 'Poo') {
    sendMessage('Wee')
  }
}

const respondToKeith = data => {
  if (data.content === 'keith' || data.content === 'Keith') {
    sendMessage('Cheggers')
  }
}

const respondToPiss = data => {
  if (data.content === 'piss' || data.content === 'Piss') {
    sendMessage('Shit')
  }
}

channel.bind(messageEvent, data => {
  respondToPoo(data)
  respondToKeith(data)
  respondToPiss(data)
})

const spammerBoard = {
  Vypyr: 10,
  KetlordOfLiverpool: 20,
  madbaddog05: 34659,
  el_bojo_loco: 3385,
  Lattz: 1927,
  Vetionarian: 463,
  alienPPC: 1436,
  glogging: 1186,
  Deep_Ez: 65,
  bigapz: 300,
  PrimedOrange: 102,
  '6ustin': 92,
  neckbeard_aficionado: 143,
  Cheggsta: 276,
  Hunty93: 67,
  DynodazeDanny: 39,
  RgsRs: 15753,
  Hexical: 196,
  HolliaU: 40,
  benjamintrnt: 149,
  zSK98: 13,
  SmashF13ND: 317,
  Slash4646: 70,
  TyroneCheggers: 5,
  shrimpy94: 25,
  mr_cheggies: 10,
  Ego6Maguire: 25,
  Dannyth96: 5,
  azzy2022: 42,
  J4M3SP: 97,
  alfzawg: 7814,
  jackboijack2: 20,
  swordandland: 11,
  BIG_McQuill: 5,
  herbito: 4,
  Rich_xp: 53,
  Endorfinz: 5,
  Ajajajk: 5,
  GrossGoreKebabAli: 203,
  BarbieXL: 5,
  Luekk: 297,
  Vx_T: 225,
  KQ_T: 215,
  IronScott_1: 5,
  Bigtotes: 20,
  CelestiaVegas: 5,
  teeayyderulo: 35,
  Mr_Mo_Mentum: 103,
  cuckywucky: 14,
  Spooke1: 5,
  HeistZC: 5,
  Purplemauled: 82,
  Branyx: 6,
  Sande: 50,
  v3rzx: 10,
  haynes: 5,
  Jooshie: 13,
  OdacIock: 74,
  Goopwhacker: 12,
  soulsacrifice: 91,
  Yoey1: 139,
  CountOnCrypto: 1454,
  HandsomeBillyOnKet: 244,
  Swampoe: 2,
  angryspe: 16,
  SumAssHole: 5,
  ImCamelphat: 10,
  Nevi_728: 21,
  CrabStickSteve: 5,
  Dynamistu: 9,
  iZAjz: 247,
  Vintaqe_Osrs: 19,
  GWJRS: 4,
  xWhist: 14,
  name1name2: 5,
  Jeremy_Vine: 74,
  YasinW: 10,
  Stxkesey: 40,
  Skutch223: 15,
  Loolsy: 10,
  seanhnn: 40,
  edshotmachine: 5,
  zatsgrazyoffers: 5,
  '666RSI': 1,
  '96migrant': 13,
  nutcrackerr: 8,
  Gaz_T: 97,
  JonJames: 12,
  ven_5: 25,
  Atychiphobiaa: 5,
  snorzi: 11,
}

const collectCheggersSpam = data => {
  if (data.content.match(/emote:2836117:grossgoreCheggers/g)) {
    const user = data.sender.username

    const count = data.content.match(/emote:2836117:grossgoreCheggers/g).length

    if (spammerBoard[user]) {
      spammerBoard[user] += count
    } else {
      spammerBoard[user] = count
    }
  }

  console.log(JSON.stringify(spammerBoard, null, 2))
}

// channel.bind(messageEvent, data => {
//   collectCheggersSpam(data)
// })

// setInterval(() => {
//   // Broadcast top 3 spammers every 40 seconds
//   const topSpammer = Object.entries(spammerBoard)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 3)
//     .map(([user, count]) => `@${user} : ${count}`)
//     .join(', ')

//   const message = `Top 3 ${cheggersEmote} spammers: ${topSpammer}`

//   console.log(message)

//   sendMessage(message)
// }, 20000)

// const cheggers = []

// let enabled = true
// let streakTimeout
// let lastEmote = ''
// const emoteStreak = []

// const endStreak = () => {
//   if (emoteStreak.length > emoteStreakMinimum && enabled) {
//     enabled = false
//     console.log('Ending streak')

//     const count = emoteStreak.length

//     const previousRecord = longestStreak

//     let appends = ''

//     if (count > longestStreak) {
//       longestStreak = count

//       if (previousRecord !== 0) {
//         appends = " That's a new record!"
//       }
//     }

//     const message = `${lastEmote} streak x${count} cheers!${appends}`

//     sendMessage(message)

//     console.log(message)

//     setTimeout(() => (enabled = true), emoteStreakCollectionCooldown * 1000)
//   }

//   console.log('Ending streak after timeout or early break')

//   lastEmote = ''
//   emoteStreak.length = 0
// }

// let cheggersCount = (
//   data.content.match(/emote:2836117:grossgoreCheggers/g) || []
// ).length

// if (cheggersCount > 0) {
//   for (i = 0; i < cheggersCount; i++) {
//     cheggers.push(Date.now())
//   }
// }

// if (data.content.match(emoteMessageRegex)) {
//   console.log(data.content)

//   clearTimeout(streakTimeout)
//   console.log('Resetting streak timeout')

//   const emote = data.content

//   if (emoteStreak.length === 0) {
//     emoteStreak.push(emote)
//   } else {
//     if (emote === lastEmote) {
//       emoteStreak.push(emote)
//     } else {
//       endStreak()
//     }
//   }

//   lastEmote = `${emote}`

//   streakTimeout = setTimeout(endStreak, emoteStreakInterval)
// }

// setInterval(() => {
//   const count = cheggers.filter(
//     timestamp => timestamp > Date.now() - 120000
//   ).length

//   const avg = Math.round(count / 2)

//   sendMessage(`Current ${cheggersEmote} per minute: ${avg}`)

//   console.log(`Current ${cheggersEmote} per minute: ${avg}`)
// }, cheggersPerMinuteBroadcastInterval * 1000)
