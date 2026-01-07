# KICK+ (WIP)


## Usage
1. Open your browser devtool / console (`F12` / `ctrl + shift + j` / `cmd + shift + j`)
2. type `allow pasting` in case pasting is blocked
3. Copy paste the snippet below
4. REPLACE `<TAG>` with the version number you want to use. The version format is `<2-digit year>.<revision>`. For example: `26.3`
```js
const tag = '<TAG>';
const script = document.createElement('script')
script.src=`https://cdn.jsdelivr.net/gh/elbojoloco/cheggers@${tag}/cheggers.js`
document.body.appendChild(script)
```

### Using latest tag
> I will try to keep this up-to-date, but if I forget, just change the version yourself
```js
const tag = '26.3';
const script = document.createElement('script')
script.src=`https://cdn.jsdelivr.net/gh/elbojoloco/cheggers@${tag}/cheggers.js`
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