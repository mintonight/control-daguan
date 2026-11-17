/* 控制大观 · Service Worker */
'use strict';

// PRECACHE 由 tools/build_precache.py 在构建时写入，请勿手改
const PRECACHE = {
  "version": "d9683fed375a",
  "files": [
    "./",
    "./index.html",
    "./app.css",
    "./manifest.webmanifest",
    "./data/library.json",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
    "./icons/icon-192.png",
    "./icons/icon-512-maskable.png",
    "./icons/icon-512.png",
    "./src/core/activity.js",
    "./src/core/errata.js",
    "./src/core/merge.js",
    "./src/core/preferences.js",
    "./src/core/question.js",
    "./src/core/record.js",
    "./src/core/studyday.js",
    "./src/core/timers.js",
    "./src/core/types.js",
    "./src/main.js",
    "./src/srs/fsrs.js",
    "./src/store/kv.js",
    "./src/store/library.js",
    "./src/store/records.js",
    "./src/sync/gist.js",
    "./src/ui/dom.js",
    "./src/ui/html.js",
    "./src/ui/icons.js",
    "./src/ui/markdown.js",
    "./src/ui/note-markdown.js",
    "./src/ui/notes-editor.js",
    "./src/ui/pwa.js",
    "./src/ui/settings.js",
    "./src/ui/view.js",
    "./vendor/dompurify/LICENSE",
    "./vendor/dompurify/purify.min.js",
    "./vendor/idb-keyval/idb-keyval.umd.js",
    "./vendor/idb-keyval/LICENCE",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
    "./vendor/katex/fonts/KaTeX_Math-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Script-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
    "./vendor/katex/katex.min.css",
    "./vendor/katex/katex.min.js",
    "./vendor/katex/README.md",
    "./vendor/marked/LICENSE.md",
    "./vendor/marked/marked.umd.js",
    "./vendor/ts-fsrs/LICENSE",
    "./vendor/ts-fsrs/ts-fsrs.umd.js"
  ],
  "integrity": {
    "./": "sha256-6yUbaWxiAlGQMdy4G3YXOBh+ftNDMPg9FBZ4F3PUNLk=",
    "./index.html": "sha256-6yUbaWxiAlGQMdy4G3YXOBh+ftNDMPg9FBZ4F3PUNLk=",
    "./app.css": "sha256-GyYU6b4eaS56AhS8jfOgfF8dSjQeF6QX05l2bN+kdwI=",
    "./manifest.webmanifest": "sha256-x69FMIeGaXmmzA12qHLwUsElKXVlfuyoQDJ5/17/QAI=",
    "./data/library.json": "sha256-2DRpWCtmtlNjbg8kixyltO4RHoNCbsBo2vfJDur1z1Q=",
    "./icons/apple-touch-icon.png": "sha256-4RVXCKLZWslYZ3BlffqZQEVSL6FXFfp4snZcrJCkYMI=",
    "./icons/favicon-32.png": "sha256-ihfMIceAr1krwXcf8x3ftBlHGJF5tjMD44z6FFz7dx4=",
    "./icons/icon-192.png": "sha256-Nhm9XvqVwGpI7IrWpAHAz/c4FPxVf3tNiKW5ikPQXrk=",
    "./icons/icon-512-maskable.png": "sha256-VA3fujSbuImUb6156ptBjCGjucmj5KvFOa/v/MogwFU=",
    "./icons/icon-512.png": "sha256-oZbRj+tADcp3XB8OAx7xAG9vwzUqMGAugZS/dvVcwNE=",
    "./src/core/activity.js": "sha256-zhxGwt40fjtVEx3I3XWCLG3jyiFgAeNVBz98TGS4iQA=",
    "./src/core/errata.js": "sha256-g4fc2gfl6Hxp/uKZqG61AmW+LdVVNNVSyLHB/Iz1oUk=",
    "./src/core/merge.js": "sha256-yMysSA0wplQkbOJGyTDXJy3+zTKwwbubxpQ44ge1oCw=",
    "./src/core/preferences.js": "sha256-JCo2trZMe9R5SWASg7f1SWeNuvdnY8R4t/4mVZz9mbs=",
    "./src/core/question.js": "sha256-ehq9pIu3yuxGurv7QSpI3BIxJvvUGL6heFGJHdXUBy8=",
    "./src/core/record.js": "sha256-4E32nugCBlO5Cl1fHIG5nUJvYoU1X83DbGVo6tMenY8=",
    "./src/core/studyday.js": "sha256-LUeJfeAYE3aABVU+cAwf9g6pyFeEogijLIyjexHQlM0=",
    "./src/core/timers.js": "sha256-S4ArXYDVGIm/ojsXmNfcIWSpBGA9S+tinenVj7GUMBc=",
    "./src/core/types.js": "sha256-+IHVWGMD5y5ARaXU257rY8lYop8AuupreK9UWYBEsXw=",
    "./src/main.js": "sha256-otIWBvrUKi22tXzPyWBLTZy/UBBt4V6X7B7auDzZmDs=",
    "./src/srs/fsrs.js": "sha256-xHqvRTU+bHg9bzHeObp6lWuE5OpvMGz1dIgs6k6pNoo=",
    "./src/store/kv.js": "sha256-+PyLXy7VodK1N8fRTNW9XbTxNDp/N6/31hCvfgvAEns=",
    "./src/store/library.js": "sha256-Qczc6JGgBgrDzs/3F8wkaoMZi1dsQTnm8EolrxOpXUg=",
    "./src/store/records.js": "sha256-nGWWyoNvEgGlVSJyT9+7D8SKSVujW3jHLel/oshH3UY=",
    "./src/sync/gist.js": "sha256-EpPLafB+OzkA+tBIdzNGxv1XqI3SLGuoFbUgXuAxFhY=",
    "./src/ui/dom.js": "sha256-45G8x9wO0gzo7rqXzSo+pUMP98Re1SMtmpcS4KfukGI=",
    "./src/ui/html.js": "sha256-pkWJOAC9ySppv/LUSXlRAWttAkcqNr7fhNWTUEQKbY4=",
    "./src/ui/icons.js": "sha256-sCHVpdqlZZdceMT3ZS7KUuRz/7MNDfBDDbhCaCmhe4w=",
    "./src/ui/markdown.js": "sha256-bnDlPhgwXkBg1kdSOlGdjnOL0gnQMlT+pRLmqYQnFwU=",
    "./src/ui/note-markdown.js": "sha256-wUVlKsJ9YENIBNkTuayDu7Xq8JYEQWOVnYB0fZU4Iik=",
    "./src/ui/notes-editor.js": "sha256-+hOCsn8Vq6nAfM9Ha9iyPovAdV1IKDzSLjSejJ6Bw9g=",
    "./src/ui/pwa.js": "sha256-w2cRikuoBzReRjeiXxTmQhgov45GHMKGYiDjUp5x/RY=",
    "./src/ui/settings.js": "sha256-FcRRXY6NYt2tr1hNTeTQOAJqP80FAwYb3ZiremNFoog=",
    "./src/ui/view.js": "sha256-jyMR8L56dI5WEhqmM0hfHqnCnCVlCa337I4UIfs5SZE=",
    "./vendor/dompurify/LICENSE": "sha256-Pd+b5cKP4n2tFDpdx27qJSIq0d1ok0oEcGTlbtL6QMU=",
    "./vendor/dompurify/purify.min.js": "sha256-YYuEDdMMPpgdSS1KdBMZ0kSZQvvW8qj1l+PHaGKUtF4=",
    "./vendor/idb-keyval/idb-keyval.umd.js": "sha256-zUSL+CG4XoFWL9DYWGjnYacV0ow/GVJxdx0Uov5cWes=",
    "./vendor/idb-keyval/LICENCE": "sha256-Kg50x1ruqNvNOD3c0xDa3imUFx+09HfRkVsCpgkxWDU=",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.ttf": "sha256-aFNIQLz90r/7bw6N60hoTdAefwTqKBMmdXevuQbeHRM=",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff": "sha256-MNqR6EyJP4deJSaJ+uvcWQsocRReitx/mp1NvYzgslE=",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2": "sha256-DN04fJWQoan5eUVgAi27WWVKfYbxh6oMgUla1C06cwg=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf": "sha256-B9jjA85PwStLtU8QBBcN0ZCh89tF1AD+aAYN8+CJcmg=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff": "sha256-Gua9dHVZDpfn8UWongnM3jIvemvAuRYHsci47igpD+0=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2": "sha256-3ncB5Czx9M8LdmwD+yeXcgfu4vT9XXb6ghiEBtpD6kw=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf": "sha256-7Qt0Ny/u/LucBmay4hDaN7fkn6f7vz7rEdtfaT2s+7c=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff": "sha256-M5jdAjAlV6eT8oY/iOAtls4Q3yq/+gfI6fqQd1EW5lw=",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2": "sha256-XVPnCtYHwjUhYt7J4JI/tU7Nr6zL9gTNjc99APrLmJs=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf": "sha256-kWPfnHEiQy5klbQin6kHHPmuhqdYrl78SSTsLhptvOE=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff": "sha256-m+fOuIAEq4rRJAgiRvv8ykCR42OF1Oxu0d9nN12tUPs=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2": "sha256-dERO/Vk8AF4/RXO0RSRwTArwqTf+kRzKnpQGjQ0UDT8=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf": "sha256-Hm+VeekOLKw3+PYKWXxDbgdcEUOFZSt8vrDewEISkbM=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff": "sha256-Xih1O+cX2sl/VZ9JvBC+nPPBJN3KvaZlnRHLaP68ZGM=",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2": "sha256-UYFNJw0G/wJV26B5mZT6TYyE0R8JlR1HWV9Kux82Atw=",
    "./vendor/katex/fonts/KaTeX_Main-Bold.ttf": "sha256-E4rCjRZjswN+nF9SNx+lxj2DJPSjjSLNVz5uo6P9DPg=",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff": "sha256-x2xdaWKX1RucsWOcfaQzTw597IG0KxEhO14l72cbuCI=",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff2": "sha256-D2DRuJeTjskYyM4HMJJBG6+UOPZzlGVpP/GLD50gsCE=",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf": "sha256-cO4fZKIPIEjCGUDvRtAUT9IVuqlTymmv0eMemFRPcI8=",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff": "sha256-pvfsDYRqx62XWtuJWcN+1JuUrLxK5DbbnOniAofkpkw=",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2": "sha256-mc1Co8By2Rjy9EmEqAfPeqFuE1Rf0IdfwHxsZfmecVs=",
    "./vendor/katex/fonts/KaTeX_Main-Italic.ttf": "sha256-DYWufMMPI3kKfxpYxKES/cqKrnaba6EUKa8dmLG2yzo=",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff": "sha256-8dbvhvOxGlKL1RhRmb0kQ+yysN6tltiGdLWiwSviS98=",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff2": "sha256-l0ecpszpBqvJYeyslvql+couYbjnZw1HWCa83umnwmc=",
    "./vendor/katex/fonts/KaTeX_Main-Regular.ttf": "sha256-0DMvUoaDcP2Drn+kZHD5DI8uqy/PErxPiAgLNAyVqDA=",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff": "sha256-xjaNh+iho6XTN2I9g9jcS4aPJCqa1HYjfW+NHg8WjNw=",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff2": "sha256-wjQs2Lhp4BdSqTIdwXIT/EDU0Ex5aIwdQ/LPMWq9eGY=",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf": "sha256-+Td6sCcc2lmvJLz/vUak0MijVy/6/bs43irV6nsNXuU=",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff": "sha256-hQwK9cIjhJf+uvXkYdiAv0WMNB9C9PMw8bGrVpixmY4=",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2": "sha256-3Ec0TbtstbZVyEYNVh9N9fUBuQyAStPGzsZf4yI1GrE=",
    "./vendor/katex/fonts/KaTeX_Math-Italic.ttf": "sha256-CM6Y5RsE1YlFowHmOeAraZivKf39Yae4r90Hu/xHnUo=",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff": "sha256-io0kRYE3GRK48/WiPiQ3yypZzZvK67A0bnIsBXN6JXE=",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff2": "sha256-evWMXsjxMqLd3pAnxteBTezOTTuCKhEZKkKiDi6XMmQ=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf": "sha256-Hs4D95+VJ31X3H9rQ1p04TebDUYQSoUwKGtg/0k2nqA=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff": "sha256-7OA8/YPiLCEs3vZv64RC0loIO+uYjbPxiD8/lzjXULo=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2": "sha256-6ZrlEUS/EjLvzBv+Wt02JixoZrD6qyT6dXQOG5hXemI=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf": "sha256-OTHdgfrthroCG7K73Db1vtmjjWtPQHespZsmWqGwIIM=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff": "sha256-ke5nUAzAEpqgrOOsXGH/FpIQLw8x0CtpNH+6Ndy3W/I=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2": "sha256-ALJqyCXiCVBWOW4FU7isJtP4rRWMOCbii0xFs4XEcUo=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf": "sha256-826ol+GfSi5XHR6QDk43EOQ43rBahCSGBFugo+YWpK0=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff": "sha256-EeTcimRx/21u5WHVPRD96PdInnmCV/9EnF03wZdDVgU=",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2": "sha256-aOjHPvQq/TzOxYvw+6MCzORIk45/wCCl4x+KlS7uE0I=",
    "./vendor/katex/fonts/KaTeX_Script-Regular.ttf": "sha256-HGfwaP6ouwm/CZwIixz2S9J1Fqbgf0aENEhzVku2amc=",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff": "sha256-2WzfKzvdTWSo/V90pMRn8SOopzkxzUNYifCP+vm/lHo=",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff2": "sha256-A21OlRSbaf+bzAzVV3Hv6yX/o5Ryk+aazXjVrDKMaEs=",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.ttf": "sha256-lbbS8aUBc7/tuMY+HRyZsQQn0KTfQgHLRFE7ImlRois=",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff": "sha256-yUPMmGOE9Z6GvqX9fcUKnE3+Vnp8BetA1nkHIN6tl8k=",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2": "sha256-a0fEAWa22+IaXfyncYQT8hR/0jmb4bpgXYrTnO3yXf4=",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.ttf": "sha256-prIJn7VVxg46DbOgiELr8dcyxutOS/RJE2E77U/E45s=",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff": "sha256-IBTFI8MhC8wWZkjE1MxX8Ft0ffB6JCd79xxR5n3Hnj0=",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2": "sha256-0ExUIZ+ersbU1P1C37KHhZdaR5TWsvxx5Wa5zW24Qt0=",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.ttf": "sha256-UA4E1U8NUWZjMsnSCJqoA74iqoeOylOeWfpTxuUisII=",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff": "sha256-ara2Lpti2uLADdkPeRvRCVC+Dsw0kNfWBF9Rwuj+CUk=",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2": "sha256-c9WRJxsWBJYMsQu5D+4CFnCvcpcBfg6YSAszLRH1GZU=",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.ttf": "sha256-xkc2fR3U4WJGhxfQIOH8Dx3Fwm6/3/vlUmFxO/iMWHc=",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff": "sha256-mfnGdQtInJRivwSQC9P5Od+bgpM52qqqme9Ulc3d6lg=",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2": "sha256-pK99QURAocF5CCXPtwDPnPQ7DyxLBPDrxSMBGtmFPsA=",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf": "sha256-8B8+h9nGphwMCBzrV3q9hk6wCmEvesFiDdaRX60u9ao=",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff": "sha256-4U/tArGrp86fWv1YRLXQMhsiNR/rxyDg3ouHI1J2Cfc=",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2": "sha256-cdUX1ngneHz6vfGGkUzDNY7aU543kxlB8rL9SiH2jAs=",
    "./vendor/katex/katex.min.css": "sha256-XmWh5CEDvscotgVERylAxMAcwacgH7UxY17BzBWEARg=",
    "./vendor/katex/katex.min.js": "sha256-op0pYdMUbeWUnXisfBqdk65UlVutIqbbT76Dbojov0g=",
    "./vendor/katex/README.md": "sha256-5kAtdLQan4B7mGw4gXReoAJmxzXBBQENey+jn8AliNA=",
    "./vendor/marked/LICENSE.md": "sha256-zgv7seLTESfjNTihWgrkoS00CANq5viU40mKUsY0xPo=",
    "./vendor/marked/marked.umd.js": "sha256-04kzIRMb0XRu/LRaEzc/mvaWnmVnzTMNrdqKTI6PaMM=",
    "./vendor/ts-fsrs/LICENSE": "sha256-dr85jcn+TZpWV1K57jvjxiD+ztswScc3iWK07EB9G90=",
    "./vendor/ts-fsrs/ts-fsrs.umd.js": "sha256-LRqzvSzEyNyId4Lz/xv4LBrLX59dSh7oxVZ47lfSfUY="
  }
};

const SHELL = 'cdg-shell-' + PRECACHE.version;
const RUNTIME = 'cdg-runtime';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      await cache.addAll(PRECACHE.files.map(url => new Request(url, {
        cache: 'reload', integrity: PRECACHE.integrity[url],
      })));
    } catch (error) {
      await caches.delete(SHELL);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('cdg-') && k !== SHELL && k !== RUNTIME)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求（含 api.github.com、Gist）一律不拦截、不缓存
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNav(req));
    return;
  }

  const path = url.pathname;
  if (path.includes('/data/questions/') || path.includes('/img/')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirstNav(req) {
  try {
    return await fetch(req);
  } catch {
    const hit = await caches.match(req) ||
      await caches.match('./index.html', { ignoreSearch: true }) ||
      await caches.match('./');
    return hit || new Response('离线不可用', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const fetching = fetch(req).then(async res => {
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  }).catch(() => undefined);
  if (cached) return cached;
  const fresh = await fetching;
  return fresh || new Response('', { status: 503, statusText: 'offline' });
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    return await fetch(req);
  } catch {
    return new Response('', { status: 503, statusText: 'offline' });
  }
}
