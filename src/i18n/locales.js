import { ROOMS_STRINGS } from './rooms.js';

const BASE = {
  zh: {
    name: '中文',
    title: '烘焙坊消消樂',
    mode: {
      heading: '烘焙坊消消樂',
      subtitle: '選一個玩法開始',
      lastPlayed: '上次玩的',
      hostLink: '我是主持人，我要開房 →',
      back: '← 回到模式選擇',
      solo: {
        title: '單人挑戰',
        desc: '60 秒衝最高分，紀錄只留在這台裝置',
      },
      multi: {
        title: '團體戰',
        desc: '輸入房號加入，和其他隊伍比分數',
      },
    },
    join: {
      heading: '加入房間',
      subtitle: '跟主持人拿房號，取一個隊名就能開打。',
      roomLabel: '房號',
      roomHint: '4 碼英數字，不會有 0 O 1 I L',
      teamLabel: '隊名',
      submit: '加入房間',
      errors: {
        roomRequired: '請先輸入房號',
        roomConfusable: '房號不會用到 0、O、1、I、L，請再跟主持人確認一次',
        roomFormat: '房號是 4 碼英數字，請再確認一次',
        teamRequired: '請輸入隊名',
        teamTooLong: '隊名最多 20 個字',
        unavailable: '多人房間還在建置中，先玩單人挑戰吧',
      },
    },
    intro: {
      heading: '烘焙坊消消樂',
      rulesLine1: '圈選麵包與咖啡豆連成一圈，',
      rulesLine2: '圈內數字總和需為 <strong>10</strong>。',
      rulesLine3: '限時 <strong>60 秒</strong>，越快越多分。',
      howToPlay: '玩法說明',
      step1: '用滑鼠或手指畫出一個圈，圈住想選的麵包或咖啡豆',
      step2: '放開後，若圈內數字總和恰好等於 10，會全部消失並得分',
      step3: '消失的位置會補上新的麵包或咖啡豆，時間內盡量拿到最高分',
      start: '開始遊戲',
    },
    hud: {
      score: '收集數',
      time: '剩餘時間',
      lightMode: '亮色模式',
      reset: '重新開始',
    },
    countdown: {
      ready: '準備',
      go: '開始！',
    },
    result: {
      newRecord: '新紀錄！',
      timeUp: '時間到！',
      score: '本局分數',
      best: '最佳紀錄',
      playAgain: '再玩一次',
    },
    lang: {
      label: '語言',
    },
  },
  en: {
    name: 'English',
    title: 'Bakery Box',
    mode: {
      heading: 'Bakery Box',
      subtitle: 'Pick how you want to play',
      lastPlayed: 'Last played',
      hostLink: "I'm the host — open a room →",
      back: '← Back to mode select',
      solo: {
        title: 'Solo Run',
        desc: '60 seconds for your best score, kept on this device',
      },
      multi: {
        title: 'Team Battle',
        desc: 'Join with a room code and go up against other teams',
      },
    },
    join: {
      heading: 'Join a room',
      subtitle: 'Grab the room code from your host, pick a team name, and play.',
      roomLabel: 'Room code',
      roomHint: '4 characters — never 0, O, 1, I or L',
      teamLabel: 'Team name',
      submit: 'Join room',
      errors: {
        roomRequired: 'Enter the room code first',
        roomConfusable: 'Room codes never use 0, O, 1, I or L — double-check with your host',
        roomFormat: 'A room code is 4 letters or digits — please check again',
        teamRequired: 'Enter a team name',
        teamTooLong: 'Team names are 20 characters max',
        unavailable: 'Team rooms are still being built — try a solo run for now',
      },
    },
    intro: {
      heading: 'Bakery Box',
      rulesLine1: 'Draw a loop around breads and coffee beans.',
      rulesLine2: 'The numbers inside must sum to <strong>10</strong>.',
      rulesLine3: 'You have <strong>60 seconds</strong>. Go fast, score big.',
      howToPlay: 'How to Play',
      step1: 'Drag with your mouse or finger to draw a loop around breads or coffee beans',
      step2: 'Release — if the sum inside equals 10, they all pop and you score',
      step3: 'New items respawn instantly. Rack up the highest score you can',
      start: 'Start Game',
    },
    hud: {
      score: 'ITEMS',
      time: 'TIME',
      lightMode: 'Light Mode',
      reset: 'Reset',
    },
    countdown: {
      ready: 'Ready',
      go: 'Go!',
    },
    result: {
      newRecord: 'NEW RECORD!',
      timeUp: "Time's Up!",
      score: 'SCORE',
      best: 'BEST',
      playAgain: 'Play Again',
    },
    lang: {
      label: 'Language',
    },
  },
  ja: {
    name: '日本語',
    title: 'ベーカリーボックス',
    mode: {
      heading: 'ベーカリーボックス',
      subtitle: '遊び方を選んでください',
      lastPlayed: '前回プレイ',
      hostLink: '司会です — ルームを開く →',
      back: '← モード選択に戻る',
      solo: {
        title: 'ひとりで挑戦',
        desc: '60秒でハイスコアを狙う。記録はこの端末に保存',
      },
      multi: {
        title: 'チーム戦',
        desc: 'ルーム番号で参加して、他のチームとスコアを競う',
      },
    },
    join: {
      heading: 'ルームに参加',
      subtitle: '司会からルーム番号をもらって、チーム名を決めれば準備完了。',
      roomLabel: 'ルーム番号',
      roomHint: '英数字4桁。0 O 1 I L は使いません',
      teamLabel: 'チーム名',
      submit: '参加する',
      errors: {
        roomRequired: 'ルーム番号を入力してください',
        roomConfusable: 'ルーム番号に 0・O・1・I・L は使いません。司会に確認してください',
        roomFormat: 'ルーム番号は英数字4桁です。もう一度確認してください',
        teamRequired: 'チーム名を入力してください',
        teamTooLong: 'チーム名は20文字までです',
        unavailable: 'チーム戦は準備中です。まずはひとりで挑戦してみてください',
      },
    },
    intro: {
      heading: 'ベーカリーボックス',
      rulesLine1: 'パンとコーヒー豆を囲むように線を描こう。',
      rulesLine2: '囲んだ数字の合計が<strong>10</strong>になるように。',
      rulesLine3: '制限時間は<strong>60秒</strong>。素早く高得点を狙おう。',
      howToPlay: '遊び方',
      step1: 'マウスや指でパンやコーヒー豆を囲むように線を描きます',
      step2: '離した時に合計が10になっていれば全部消えて得点',
      step3: '消えた場所には新しいアイテムが出現。制限時間内に高得点を目指そう',
      start: 'ゲーム開始',
    },
    hud: {
      score: '獲得数',
      time: '残り時間',
      lightMode: 'ライトモード',
      reset: 'リセット',
    },
    countdown: {
      ready: '準備',
      go: 'スタート！',
    },
    result: {
      newRecord: 'ニューレコード！',
      timeUp: 'タイムアップ！',
      score: 'スコア',
      best: 'ベスト',
      playAgain: 'もう一度',
    },
    lang: {
      label: '言語',
    },
  },
};

// The room screens ship their own copy so the multiplayer work could land
// without every locale change colliding in this file.
export const LOCALES = Object.fromEntries(
  Object.entries(BASE).map(([code, dict]) => [code, { ...dict, ...(ROOMS_STRINGS[code] || {}) }]),
);

export const DEFAULT_LOCALE = 'zh';
