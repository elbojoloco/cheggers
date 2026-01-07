# KICK+ (WIP)


## Usage
1. Open your browser devtool / console
2. type `allow pasting` in case pasting is blocked
3. Copy paste the snippet below
4. REPLACE `<TAG>` with the version number you want to use. The version format is `<2-digit year>.<revision>`. For example: `26.1`
```js
const script = document.createElement('script')
script.src="https://cdn.jsdelivr.net/gh/elbojoloco/cheggers@<TAG>/cheggers.js"
document.body.appendChild(script)
```

## To do:

- [x] Overwrite quick emotes click handler to bypass rate limit
- Random TTS
    - [ ] Set a word length limit
    - [ ] Don't include words from bot messages
    - [ ] Add a word blacklist to reduce risk
    - [ ] Set a hard character limit
    - [x] Make voices list configurable
- [ ] Add copy pasta management tool
- [ ] Add song request timer
- [ ] IDEA: Automatic song request every 10 minutes