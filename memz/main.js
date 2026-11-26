(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Memz = factory());
})(this, (function () { 'use strict';

    // Shorthand for document.querySelectorAll<HTMLElement>("selector")
    const $$ = selector => document.querySelectorAll(selector);
    // The name of the css file to import from the assets path
    const cssFileName = 'winmb.css';
    // The name of the class that will be used to identify our message boxes within the DOM
    // Must be the same as in winmb.css
    const cssClass = 'winmb';
    class WinMB {
      // An url for the assets MUST be specified.
      // We also load the required css into the page
      constructor(assetsUrl) {
        var _this = this;
        // Return the complete url of an asset given its filename.
        this.getAssetUrl = filename => this.assetsUrl + filename;
        // Remove all the dialogue boxes
        this.removeAll = () => {
          this.boxList.forEach(messageBox => {
            messageBox.parentElement.removeChild(messageBox);
          });
        };
        this.show = async function (title, message) {
          let type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'error';
          let buttons = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [{
            text: 'ok',
            value: true
          }];
          let position = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'default';
          if (typeof position === 'string' && !['random', 'default'].includes(position)) throw new Error('Position must be either "random", "default", or an array of two numbers [x, y].');
          if (!['info', 'error', 'warning'].includes(type)) throw new Error('Invalid message type : please use "info", "error" or "warning"');
          if (!Array.isArray(buttons)) throw new Error('Invalid buttons : please use an array of [label, returnValue]');
          if (!(buttons.length > 0)) throw new Error('Invalid button list : please specify at least one button');
          return new Promise(resolve => {
            let startMouseX = 0;
            let startMouseY = 0;
            let startMessagePosY = 0;
            let startMessagePosX = 0;
            const GetRandomInt = (min, max) => {
              min = Math.ceil(min);
              max = Math.floor(max);
              const RandomInt = Math.floor(Math.random() * (max - min + 1)) + min;
              return RandomInt;
            };
            const playSound = path => {
              new AudioContext();
              const audio = new Audio(path);
              audio.play();
              return audio;
            };
            // Put messageBox on top of other boxes using zIndex
            const setZIndex = () => {
              _this.boxList.forEach(element => {
                if (parseInt(element.style.zIndex) > parseInt(messageBox.style.zIndex) - 1) messageBox.style.zIndex = (parseInt(element.style.zIndex) + 1).toString();
              });
            };
            playSound(_this.getAssetUrl(type + '-sound.wav'));
            const messageBox = document.createElement('div');
            messageBox.classList.add(cssClass);
            messageBox.style.zIndex = (_this.boxList.length + 1).toString();
            if (position === 'random') position = [GetRandomInt(0, window.innerWidth), GetRandomInt(0, window.innerHeight)];else if (position === 'default') messageBox.style.left = messageBox.style.top = 100 + (_this.boxList.length + 1) * 15 + 'px';
            messageBox.style.left = position[0] + 'px';
            messageBox.style.top = position[1] + 'px';
            messageBox.innerHTML = '<div class="titleBar">' + `<span class="title">${title}</span>` + `<img class="closeButton" src="${_this.getAssetUrl('close-button.png')}" alt="close button">` + '</div>' + '<div class="content">' + `<img src="${_this.getAssetUrl(type + '.png')}" alt="icon">` + `<span class="message">${message}</span>` + '</div>' + '<div class="buttons">' + '</div>';
            setZIndex();
            const closeButton = messageBox.querySelector('.closeButton');
            closeButton.addEventListener('mousedown', () => {
              messageBox.parentNode.removeChild(messageBox);
              resolve(false);
            });
            messageBox.onmousedown = setZIndex;
            const buttonsContainer = messageBox.querySelector('.buttons');
            buttons.forEach(button => {
              const buttonElement = document.createElement('button');
              buttonElement.classList.add('button');
              buttonElement.innerText = button.text;
              buttonsContainer.appendChild(buttonElement);
              buttonElement.onclick = function () {
                messageBox.parentNode.removeChild(messageBox);
                if (typeof button.value !== 'undefined') resolve(button.value);
                resolve(button.text);
              };
            });
            const titleBar = messageBox.querySelector('.titleBar');
            titleBar.onmousedown = event => {
              titleBar.classList.add('clicked');
              startMouseX = event.clientX;
              startMouseY = event.clientY;
              setZIndex();
              startMessagePosX = parseInt(messageBox.style.left.substring(0, messageBox.style.left.length - 2));
              startMessagePosY = parseInt(messageBox.style.top.substring(0, messageBox.style.top.length - 2));
            };
            titleBar.onmouseup = function () {
              titleBar.classList.remove('clicked');
            };
            document.addEventListener('mousemove', event => {
              if (titleBar.classList.contains('clicked')) {
                const left = startMessagePosX - (startMouseX - event.clientX);
                messageBox.style.left = left.toString() + 'px';
                messageBox.style.top = startMessagePosY - (startMouseY - event.clientY) + 'px';
              }
            });
            messageBox.setAttribute('tabindex', '0');
            messageBox.style.outline = 'none';
            messageBox.onkeydown = event => {
              if (event.key === 'Enter') {
                messageBox.parentNode.removeChild(messageBox);
                resolve(false);
                // Focus previous messagebox if any
                if (_this.boxList.length > 0) {
                  const el = _this.boxList.at(-1);
                  el.focus();
                }
              }
            };
            document.body.appendChild(messageBox);
            messageBox.focus();
          });
        };
        this.assetsUrl = assetsUrl;
        // Must end with / since assets name are just added at the end of the base url
        if (!this.assetsUrl.endsWith('/')) this.assetsUrl += '/';
        // Load the css into the page if not already done
        const cssId = 'winmb-css';
        if (!document.getElementById(cssId)) {
          const head = document.getElementsByTagName('head')[0];
          const link = document.createElement('link');
          link.id = cssId;
          link.rel = 'stylesheet';
          link.type = 'text/css';
          link.href = this.getAssetUrl(cssFileName);
          link.media = 'all';
          head.appendChild(link);
        }
      }
      // Returns an array of every dialogue box
      get boxList() {
        return Array.from($$(`.${cssClass}`));
      }
    }

    // Messages from the original virus
    const MessageBoxes = ['',
    // empty message
    'still using this computer?', '<Insert Joel quote here>', 'SOMEBODY ONCE TOLD ME THE MEMZ ARE GONNA ROLL ME', '#MakeMalwareGreatAgain', 'GET BETTER HAX NEXT TIME xD', 'BSOD INCOMING', 'SecureBoot sucks', 'Have you tried turning it off and on again?', "'This is everything I want in my computer' - danooct1", "Well, hello there. I don't believe we've been properly introduced. I'm Bonzi!", 'YOU TRIED SO HARD AND GOT SO FAR, BUT IN THE END, YOUR PC WAS STILL FUCKED!', 'HAVE FUN TRIED TO RESTORE YOUR DATA :D', 'REST IN PISS, FOREVER MISS.', 'You failed at your 1337 h4x0r skillz'];
    const cursors = ['pointer', 'crosshair', 'move', 'grab', 'grabbing', 'help', 'wait', 'text', 'wait', 'cell', 'context-menu', 'col-resize', 'row-resize', 'no-drop', 'not-allowed', 'progress', 'all-scroll', 'zoom-in', 'zoom-out', 'grabbing', 'grab'];

    const getRandomInt = (min, max) => {
      min = Math.ceil(min);
      max = Math.floor(max);
      const RandomInt = Math.floor(Math.random() * (max - min + 1)) + min;
      return RandomInt;
    };
    const playSound = path => {
      new AudioContext();
      const audio = new Audio(path);
      audio.play();
    };
    const random = list => list[Math.floor(Math.random() * list.length)];

    const soundCount = 6;
    const winmbAssetsUrl = 'https://cdn.jsdelivr.net/gh/SkwalExe/WinMB.js@0.1.2/src/assets/';
    class Memz {
      constructor(assetsUrl) {
        // Randomly change the cursor using the css cursor property
        this.changeCursor = () => {
          // list of value for the css cursor property
          setInterval(() => {
            // set the cursor to a random value
            document.documentElement.style.cursor = random(cursors);
          }, 15);
        };
        // Randomly play sounds
        this.computerSounds = () => {
          setInterval(() => {
            if (getRandomInt(0, 3) === 2) playSound(`${this.assetsUrl}sound${getRandomInt(1, soundCount)}.wav`);
          }, 400);
        };
        this.floatingIcons = () => {
          document.addEventListener('mousemove', e => {
            if (getRandomInt(0, 20) === 0) {
              const icon = document.createElement('img');
              icon.src = `${this.assetsUrl}${random(['error', 'warning'])}.png`;
              icon.style.position = 'fixed';
              icon.style.pointerEvents = 'none';
              const iconSize = 40;
              icon.style.height = icon.style.width = iconSize.toString() + 'px';
              // Align the center of the icon with the position of the mouse
              icon.style.top = (e.clientY - iconSize / 2).toString() + 'px';
              icon.style.left = (e.clientX - iconSize / 2).toString() + 'px';
              document.body.appendChild(icon);
            }
          });
        };
        this.messageBoxes = () => {
          setInterval(() => {
            if (getRandomInt(0, 1) === 0) {
              const type = random(['warning', 'error', 'info']);
              const message = random(MessageBoxes);
              this.w.show('MEMZ', message, type, [{
                text: 'OK',
                value: true
              }], 'random');
            }
          }, 1000);
        };
        this.invertColors = () => {
          setInterval(() => {
            if (getRandomInt(0, 4) === 0) {
              document.documentElement.style.filter = 'invert(100%)';
              setTimeout(() => {
                document.documentElement.style.filter = 'invert(0%)';
              }, 1000);
            }
          }, 200);
        };
        this.rotateScreen = () => {
          setInterval(() => {
            if (getRandomInt(0, 15) === 0) {
              document.documentElement.style.transform = 'rotate(180deg)';
              setTimeout(() => {
                document.documentElement.style.transform = 'rotate(0deg)';
              }, getRandomInt(200, 3000));
            }
          }, 200);
        };
        this.all = () => {
          this.changeCursor();
          this.invertColors();
          this.messageBoxes();
          this.rotateScreen();
          this.floatingIcons();
          this.computerSounds();
        };
        if (typeof assetsUrl === 'undefined') throw new Error('You must provide a base assets url. If you do not know what this is take a look at the github repo');
        this.w = new WinMB(winmbAssetsUrl);
        this.assetsUrl = assetsUrl;
        // Must end with / since assets name are just added at the end of the base url
        if (!this.assetsUrl.endsWith('/')) this.assetsUrl += '/';
      }
    }

    return Memz;

}));
