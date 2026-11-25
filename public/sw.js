/* 控制大观 · Service Worker */
'use strict';

// PRECACHE 由 tools/build_precache.py 在构建时写入，请勿手改
const PRECACHE = {
  "version": "8a5017748ebb",
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
    "./vendor/idb-keyval/LICENCE",
    "./vendor/idb-keyval/idb-keyval.umd.js",
    "./vendor/katex/README.md",
    "./vendor/katex/contrib/copy-tex.min.js",
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
    "./vendor/marked/LICENSE.md",
    "./vendor/marked/marked.umd.js",
    "./vendor/ts-fsrs/LICENSE",
    "./vendor/ts-fsrs/ts-fsrs.umd.js"
  ],
  "integrity": {
    "./": "sha256-q2g78el6GRXnmMH56NcgCTpx4hS9joJ4OlZ95eoRLBM=",
    "./index.html": "sha256-q2g78el6GRXnmMH56NcgCTpx4hS9joJ4OlZ95eoRLBM=",
    "./app.css": "sha256-QG9Zf1bZtTz2QiLoBAfbst//S37zyoTZz0KnuFLNCNM=",
    "./manifest.webmanifest": "sha256-ZrcDxEM2u72u5QMKdyBVo4SHynb9/lcn4RctC2GcBco=",
    "./data/library.json": "sha256-2DRpWCtmtlNjbg8kixyltO4RHoNCbsBo2vfJDur1z1Q=",
    "./icons/apple-touch-icon.png": "sha256-4RVXCKLZWslYZ3BlffqZQEVSL6FXFfp4snZcrJCkYMI=",
    "./icons/favicon-32.png": "sha256-ihfMIceAr1krwXcf8x3ftBlHGJF5tjMD44z6FFz7dx4=",
    "./icons/icon-192.png": "sha256-Nhm9XvqVwGpI7IrWpAHAz/c4FPxVf3tNiKW5ikPQXrk=",
    "./icons/icon-512-maskable.png": "sha256-VA3fujSbuImUb6156ptBjCGjucmj5KvFOa/v/MogwFU=",
    "./icons/icon-512.png": "sha256-oZbRj+tADcp3XB8OAx7xAG9vwzUqMGAugZS/dvVcwNE=",
    "./src/core/activity.js": "sha256-H1EwQ20ynnQW2pVm5Ur5WMiW6D6sOCm5aJCCKxGs32o=",
    "./src/core/errata.js": "sha256-rjXeSTpCIO2v1brZwxl9pfkFNjwG9MJN5K7EoAfLQ58=",
    "./src/core/merge.js": "sha256-SrvvhF0RuWgpV2PqFJO4wgIPBb8F4N9AUAnYNyBKSwg=",
    "./src/core/preferences.js": "sha256-HJSbruNuiaGKUkA8My1biSC7kHodgmD0ZtD0U8VpAVg=",
    "./src/core/question.js": "sha256-PpINkerXIOkAZBGQ5w1yoCEzsgpRRyRaicAp854Jlxs=",
    "./src/core/record.js": "sha256-3m3AcCxl6CH/n1gfW3VE3lsDghJ70JQbNmq0lBBNJYE=",
    "./src/core/studyday.js": "sha256-VzhEix3jLy/Sl8lYGzWWTt7hD/Xig0OAbV0YZYx2Yrs=",
    "./src/core/timers.js": "sha256-epooyZa2dmQmIh4s8SGdcAiZL3mn+VlVhmGLUTGoLCc=",
    "./src/core/types.js": "sha256-soZ2AcysefOo+nY4Zio/9+Q+DDZFjXBwH1ByCMBhwcs=",
    "./src/main.js": "sha256-YKPMs8pKk97ChPatb7eUDGOBYvZoccmflyWzxPTt6dQ=",
    "./src/srs/fsrs.js": "sha256-mDKQEBqYyhVq8D/dmhCgqDAbmnubOq2RbfPexlGAioI=",
    "./src/store/kv.js": "sha256-VoI4k/uIBfijOfXhWAVPpnQQYyB7uoj/pzXu+1Z/jtQ=",
    "./src/store/library.js": "sha256-3M3bcOEePF2LpvpQEstv+CpPEw0T7/zz7hdWa1V+HzU=",
    "./src/store/records.js": "sha256-yAg+bF/P6JtDv0BYL9VIzMykWKVVUj4ZbS1FJhR9DV8=",
    "./src/sync/gist.js": "sha256-QVi8OZ5j9zzf2ZQ9wCs9tURD+0K9FC7yFM28M1FdP6w=",
    "./src/ui/dom.js": "sha256-3QRu+++AkqGTW2jXCupSN1M5w37IecQ38JbRTxZUBSI=",
    "./src/ui/html.js": "sha256-sxzgeI9nTk/eWS+fvMLy4rGVmxOxcQvhBm9i4o/AEHA=",
    "./src/ui/icons.js": "sha256-eD27zFW+KSGjYY0VbzKXefs61R/dVQQC7UDdMksbwJM=",
    "./src/ui/markdown.js": "sha256-M50uwueavR2DHo6stv2T7WFFXWvIzlnqWJ7wY4Emrfs=",
    "./src/ui/note-markdown.js": "sha256-B/eXuz31VOgZ9WiwVajr1T3UJ1g4B2yxIhm3Dz8iVuw=",
    "./src/ui/notes-editor.js": "sha256-qub7EVgNYhyOEFxTVqi9D5Grwdjl+xNu0B/ZxMzCk7A=",
    "./src/ui/pwa.js": "sha256-Olq1qg/V+9R46HqqQm66VQAGEgF/J4pmof3MGvVa6gM=",
    "./src/ui/settings.js": "sha256-7oZ6t/9dVkbbtGPwuJtHJbz6/3YsC2DUfPnGKr0GDWU=",
    "./src/ui/view.js": "sha256-PreYQ1uyqPpWTNXkVL0yjE/T5+1TOhePeAAkb6Nbl6Y=",
    "./vendor/dompurify/LICENSE": "sha256-z8d0m5b2O9McPEK1xHG/dWgUBT6EfBDz6wA0F7xSPTA=",
    "./vendor/dompurify/purify.min.js": "sha256-zTeJj5eCrfVIIMQTGRtWkYA/DxN8eZ1u3P04UjtMLDE=",
    "./vendor/idb-keyval/LICENCE": "sha256-IMJ9YzlhnusxE8uGXU6Yo/VZ5Slk/HXK6py1+nJnRWU=",
    "./vendor/idb-keyval/idb-keyval.umd.js": "sha256-HVrvoMHMeJYu8RbxG3YI2v6r9JUPccuZ/atBBCKSHVI=",
    "./vendor/katex/README.md": "sha256-giyGYixXQ9voPZvzMNZ1C70kSyvLGuD8U2+cxsTnjVA=",
    "./vendor/katex/contrib/copy-tex.min.js": "sha256-xXHEm1IMuOkEAoczgoayF4Pjm0dmYLi1bZ4cA37q6v8=",
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
    "./vendor/katex/katex.min.css": "sha256-AomgLPRRpE3XOt1oOglkQlI2OHGsEXE6ZHtzLO6LHuM=",
    "./vendor/katex/katex.min.js": "sha256-op0pYdMUbeWUnXisfBqdk65UlVutIqbbT76Dbojov0g=",
    "./vendor/marked/LICENSE.md": "sha256-jjo/gvWaYJWPVsoI9EVkfDKkcz3HymwsRvbriYRxq5w=",
    "./vendor/marked/marked.umd.js": "sha256-15MdHNe/cn3XVshxY37cyeD4U4ADuSc2hADsHuR6ndk=",
    "./vendor/ts-fsrs/LICENSE": "sha256-i4OnPdKJT/VT1t5hEwZLOtnfrT+DmDe2HzsYOIETHQE=",
    "./vendor/ts-fsrs/ts-fsrs.umd.js": "sha256-bvIzCCIaWaUkwYFT5mVIAVm8Tibp1DenDZ4ekSzFRVQ="
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
