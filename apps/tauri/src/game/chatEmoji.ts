/**
 * Owner 10-16: chat EMOJI by shortcode. FUMBBL coaches type Slack / GitHub style shortcodes (":joy:", ":wink:",
 * ":thumbsup:", ":+1:"); the chat surfaces (Text and Bubbles chat, the chat toasts, the popped-out chat) show them as
 * the unicode emoji. DISPLAY ONLY: the wire text and the stored chat entries keep the literal shortcode (bug reports
 * read the literal); the match log never calls this.
 *
 * Token rules (renderChatEmoji):
 *  - a whole token `:name:`, name = letters, digits, underscore, plus, minus, 2 to 40 chars, known to the table
 *    (case-insensitive); a letter, digit, _, + or - right before or after the token keeps it literal ("a:joy:b",
 *    ":foo_:joy:"), so an unknown code never lends its closing colon to the next token;
 *  - unknown names stay literal, a lone colon and a time like 12:30 (or 12:30:45) are never touched;
 *  - nothing inside a URL (any scheme://, www., or a bare host with a path like fumbbl.com/...) is replaced.
 */

/** name emoji pairs, whitespace separated; aliases repeat the emoji. The common GitHub set, no flags. */
const TABLE_SOURCE = `
smile 😄 smiley 😃 grinning 😀 grin 😁 laughing 😆 satisfied 😆 sweat_smile 😅 joy 😂 rofl 🤣 rolling_on_the_floor_laughing 🤣
relaxed ☺️ blush 😊 innocent 😇 slightly_smiling_face 🙂 upside_down_face 🙃 wink 😉 relieved 😌 heart_eyes 😍
smiling_face_with_three_hearts 🥰 kissing_heart 😘 kissing 😗 kissing_smiling_eyes 😙 kissing_closed_eyes 😚 yum 😋
stuck_out_tongue 😛 stuck_out_tongue_winking_eye 😜 stuck_out_tongue_closed_eyes 😝 zany_face 🤪 money_mouth_face 🤑
hugs 🤗 hugging_face 🤗 hand_over_mouth 🤭 shushing_face 🤫 thinking 🤔 thinking_face 🤔 zipper_mouth_face 🤐
raised_eyebrow 🤨 neutral_face 😐 expressionless 😑 no_mouth 😶 smirk 😏 unamused 😒 roll_eyes 🙄 grimacing 😬
lying_face 🤥 pensive 😔 sleepy 😪 drooling_face 🤤 sleeping 😴 mask 😷 face_with_thermometer 🤒
face_with_head_bandage 🤕 nauseated_face 🤢 vomiting_face 🤮 sneezing_face 🤧 hot_face 🥵 cold_face 🥶
woozy_face 🥴 dizzy_face 😵 exploding_head 🤯 cowboy_hat_face 🤠 partying_face 🥳 sunglasses 😎 nerd_face 🤓
monocle_face 🧐 confused 😕 worried 😟 slightly_frowning_face 🙁 frowning_face ☹️ open_mouth 😮 hushed 😯
astonished 😲 flushed 😳 pleading_face 🥺 frowning 😦 anguished 😧 fearful 😨 cold_sweat 😰
disappointed_relieved 😥 cry 😢 sob 😭 scream 😱 confounded 😖 persevere 😣 disappointed 😞 sweat 😓
weary 😩 tired_face 😫 yawning_face 🥱 triumph 😤 rage 😡 pout 😡 angry 😠 cursing_face 🤬 smiling_imp 😈 imp 👿
skull 💀 skull_and_crossbones ☠️ hankey 💩 poop 💩 shit 💩 clown_face 🤡 japanese_ogre 👹 japanese_goblin 👺
ghost 👻 alien 👽 space_invader 👾 robot 🤖 smiley_cat 😺 smile_cat 😸 joy_cat 😹 heart_eyes_cat 😻
smirk_cat 😼 scream_cat 🙀 crying_cat_face 😿 pouting_cat 😾 see_no_evil 🙈 hear_no_evil 🙉 speak_no_evil 🙊
kiss 💋 love_letter 💌 cupid 💘 gift_heart 💝 sparkling_heart 💖 heartpulse 💗 heartbeat 💓 revolving_hearts 💞
two_hearts 💕 heart_decoration 💟 heavy_heart_exclamation ❣️ broken_heart 💔 heart ❤️ orange_heart 🧡
yellow_heart 💛 green_heart 💚 blue_heart 💙 purple_heart 💜 brown_heart 🤎 black_heart 🖤 white_heart 🤍
100 💯 anger 💢 boom 💥 collision 💥 dizzy 💫 sweat_drops 💦 dash 💨 hole 🕳️ bomb 💣 speech_balloon 💬
thought_balloon 💭 zzz 💤
wave 👋 raised_back_of_hand 🤚 raised_hand ✋ hand ✋ vulcan_salute 🖖 ok_hand 👌 pinching_hand 🤏 v ✌️
crossed_fingers 🤞 love_you_gesture 🤟 metal 🤘 call_me_hand 🤙 point_left 👈 point_right 👉 point_up_2 👆
middle_finger 🖕 fu 🖕 point_down 👇 point_up ☝️ +1 👍 thumbsup 👍 -1 👎 thumbsdown 👎 fist_raised ✊ fist ✊
fist_oncoming 👊 facepunch 👊 punch 👊 fist_left 🤛 fist_right 🤜 clap 👏 raised_hands 🙌 open_hands 👐
palms_up_together 🤲 handshake 🤝 pray 🙏 writing_hand ✍️ nail_care 💅 selfie 🤳 muscle 💪 leg 🦵 foot 🦶
ear 👂 nose 👃 brain 🧠 tooth 🦷 bone 🦴 eyes 👀 eye 👁️ tongue 👅 lips 👄
baby 👶 boy 👦 girl 👧 man 👨 woman 👩 older_man 👴 older_woman 👵 cop 👮 guardsman 💂 detective 🕵️
construction_worker 👷 prince 🤴 princess 👸 angel 👼 santa 🎅 mage 🧙 fairy 🧚 vampire 🧛 merperson 🧜 elf 🧝
genie 🧞 zombie 🧟 facepalm 🤦 man_facepalming 🤦‍♂️ woman_facepalming 🤦‍♀️ shrug 🤷 man_shrugging 🤷‍♂️
woman_shrugging 🤷‍♀️ bow 🙇 raising_hand 🙋 no_good 🙅 ok_woman 🙆 runner 🏃 running 🏃 walking 🚶 dancer 💃
man_dancing 🕺 person_fencing 🤺 cartwheeling 🤸 juggling_person 🤹 weight_lifting 🏋️ ninja 🥷
dog 🐶 cat 🐱 mouse 🐭 hamster 🐹 rabbit 🐰 fox_face 🦊 bear 🐻 panda_face 🐼 koala 🐨 tiger 🐯 lion 🦁
cow 🐮 pig 🐷 frog 🐸 monkey_face 🐵 chicken 🐔 penguin 🐧 bird 🐦 eagle 🦅 duck 🦆 owl 🦉 bat 🦇 wolf 🐺
boar 🐗 horse 🐴 unicorn 🦄 bee 🐝 bug 🐛 butterfly 🦋 snail 🐌 beetle 🐞 ant 🐜 spider 🕷️ scorpion 🦂
turtle 🐢 snake 🐍 lizard 🦎 t-rex 🦖 sauropod 🦕 octopus 🐙 squid 🦑 shrimp 🦐 crab 🦀 fish 🐟 shark 🦈
whale 🐳 crocodile 🐊 rat 🐀 goat 🐐 sheep 🐑 elephant 🐘 rhinoceros 🦏 gorilla 🦍 dragon 🐉 dragon_face 🐲
feet 🐾 paw_prints 🐾 chipmunk 🐿️
cactus 🌵 christmas_tree 🎄 evergreen_tree 🌲 deciduous_tree 🌳 palm_tree 🌴 seedling 🌱 herb 🌿 shamrock ☘️
four_leaf_clover 🍀 mushroom 🍄 rose 🌹 tulip 🌷 sunflower 🌻 cherry_blossom 🌸 bouquet 💐 fallen_leaf 🍂
sunny ☀️ cloud ☁️ partly_sunny ⛅ cloud_with_rain 🌧️ thunder_cloud_and_rain ⛈️ cloud_with_lightning 🌩️
zap ⚡ snowflake ❄️ snowman ⛄ fire 🔥 droplet 💧 ocean 🌊 rainbow 🌈 star ⭐ star2 🌟 sparkles ✨
crescent_moon 🌙 full_moon 🌕 new_moon 🌑 earth_africa 🌍 earth_americas 🌎 comet ☄️ tornado 🌪️ fog 🌫️
apple 🍎 green_apple 🍏 pear 🍐 tangerine 🍊 lemon 🍋 banana 🍌 watermelon 🍉 grapes 🍇 strawberry 🍓
peach 🍑 cherries 🍒 pineapple 🍍 tomato 🍅 eggplant 🍆 hot_pepper 🌶️ corn 🌽 carrot 🥕 potato 🥔
bread 🍞 cheese 🧀 meat_on_bone 🍖 poultry_leg 🍗 bacon 🥓 hamburger 🍔 fries 🍟 pizza 🍕 hotdog 🌭
taco 🌮 burrito 🌯 egg 🥚 popcorn 🍿 ramen 🍜 spaghetti 🍝 sushi 🍣 cake 🍰 birthday 🎂 cookie 🍪
doughnut 🍩 chocolate_bar 🍫 candy 🍬 lollipop 🍭 coffee ☕ tea 🍵 beer 🍺 beers 🍻 clinking_glasses 🥂
wine_glass 🍷 tumbler_glass 🥃 cocktail 🍸 tropical_drink 🍹 champagne 🍾 milk_glass 🥛 cup_with_straw 🥤
football 🏈 american_football 🏈 soccer ⚽ basketball 🏀 baseball ⚾ tennis 🎾 volleyball 🏐 rugby_football 🏉
8ball 🎱 golf ⛳ ice_hockey 🏒 boxing_glove 🥊 martial_arts_uniform 🥋 goal_net 🥅 dart 🎯 bowling 🎳
trophy 🏆 medal_sports 🏅 1st_place_medal 🥇 2nd_place_medal 🥈 3rd_place_medal 🥉 medal_military 🎖️
game_die 🎲 dice 🎲 chess_pawn ♟️ jigsaw 🧩 video_game 🎮 joystick 🕹️ slot_machine 🎰 black_joker 🃏
tada 🎉 party 🎉 confetti_ball 🎊 balloon 🎈 gift 🎁 ribbon 🎀 crown 👑 tophat 🎩 mortar_board 🎓
ticket 🎫 tickets 🎟️ performing_arts 🎭 art 🎨 clapper 🎬 microphone 🎤 headphones 🎧 musical_note 🎵
notes 🎶 guitar 🎸 trumpet 🎺 drum 🥁 bell 🔔 no_bell 🔕 loudspeaker 📢 mega 📣
moneybag 💰 dollar 💵 euro 💶 pound 💷 coin 🪙 gem 💎 money_with_wings 💸 chart_with_upwards_trend 📈
chart_with_downwards_trend 📉 hourglass ⌛ hourglass_flowing_sand ⏳ watch ⌚ alarm_clock ⏰ stopwatch ⏱️
hammer 🔨 axe 🪓 pick ⛏️ wrench 🔧 nut_and_bolt 🔩 gear ⚙️ shield 🛡️ dagger 🗡️ crossed_swords ⚔️
bow_and_arrow 🏹 gun 🔫 knife 🔪 pill 💊 syringe 💉 adhesive_bandage 🩹 stethoscope 🩺 dna 🧬
crystal_ball 🔮 magic_wand 🪄 key 🔑 old_key 🗝️ lock 🔒 unlock 🔓 bulb 💡 flashlight 🔦 candle 🕯️
book 📖 books 📚 memo 📝 pencil2 ✏️ scroll 📜 page_facing_up 📄 envelope ✉️ email 📧 mailbox 📫 package 📦
calendar 📆 date 📅 clipboard 📋 pushpin 📌 paperclip 📎 scissors ✂️ wastebasket 🗑️ mag 🔍 telescope 🔭
phone ☎️ iphone 📱 computer 💻 keyboard ⌨️ tv 📺 camera 📷 movie_camera 🎥 battery 🔋 rocket 🚀
car 🚗 bus 🚌 ambulance 🚑 fire_engine 🚒 police_car 🚓 bike 🚲 airplane ✈️ ship 🚢 anchor ⚓
house 🏠 hospital 🏥 stadium 🏟️ tent ⛺
warning ⚠️ no_entry ⛔ no_entry_sign 🚫 x ❌ o ⭕
heavy_check_mark ✔️ white_check_mark ✅ ballot_box_with_check ☑️ heavy_multiplication_x ✖️ question ❓
grey_question ❔ exclamation ❗ heavy_exclamation_mark ❗ grey_exclamation ❕ bangbang ‼️ interrobang ⁉️
recycle ♻️ infinity ♾️ peace_symbol ☮️ yin_yang ☯️ radioactive ☢️ biohazard ☣️ arrow_up ⬆️ arrow_down ⬇️
arrow_left ⬅️ arrow_right ➡️ arrows_counterclockwise 🔄 repeat 🔁 new 🆕 free 🆓 cool 🆒 ok 🆗 up 🆙 sos 🆘
top 🔝 soon 🔜 end 🔚 back 🔙 on 🔛 red_circle 🔴 large_blue_circle 🔵 black_circle ⚫ white_circle ⚪
green_circle 🟢 yellow_circle 🟡 one 1️⃣ two 2️⃣ three 3️⃣ four 4️⃣ five 5️⃣ six 6️⃣ zero 0️⃣ keycap_ten 🔟
`;

export const CHAT_EMOJI: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const parts = TABLE_SOURCE.trim().split(/\s+/);
  for (let i = 0; i + 1 < parts.length; i += 2) map.set(parts[i]!.toLowerCase(), parts[i + 1]!);
  return map;
})();

export type ChatEmojiSegment = { t: string; emoji?: never; code?: never } | { t: string; emoji: true; code: string };

const TOKEN = /:([A-Za-z0-9_+-]{2,40}):/g;
// A link: any scheme:// link or www. host (wherever it starts, after "..." too), a no-slash scheme only with the payload
// it needs (mailto:x@y, tel:+123, sms:123, geo:12,34, magnet:?...; a generic "word:" or "news:" label is NOT a link, so
// "dice:[:skull:]" and "injury news:[:skull:]" render), or a bare host (Unicode, punycode or IPv4, optional :port)
// followed by a path, query or fragment. A run stops at whitespace and at < > " ` and smart quotes; an unbalanced
// closing ) or ] ends it too (urlEnd), as does the closing ' of a link opened right after a ', so
// "(https://x.org/a):joy:", "'https://x.org/a':joy:" and "‘https://x.org/a’:joy:" render the emoji after it. Astra 10-16.
const URL_RUN = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>"`‘’“”]+|(?<![\p{L}\p{N}_+-])(?:mailto:[^\s@:]+@|(?:tel|sms):\+?\d|geo:-?\d|magnet:\?)[^\s<>"`‘’“”]*|(?<![\p{L}\p{N}_-])(?:(?:[\p{L}\p{N}-]+\.)+(?:\p{L}{2,}|xn--[a-z0-9-]+)|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?[/?#][^\s<>"`‘’“”]*/giu;
/** Length of a link run up to its first unbalanced closing ) or ] (a wrapper around the link, not part of it). */
function urlEnd(run: string, quoted = false): number {
  // a link opened right after a ' ends at the next ' (the closing quote of 'https://...')
  if (quoted) { const q = run.indexOf("'"); if (q >= 0) return q; }
  let paren = 0;
  let square = 0;
  for (let k = 0; k < run.length; k++) {
    const ch = run[k];
    if (ch === '(') paren++;
    else if (ch === '[') square++;
    else if (ch === ')') { if (paren === 0) return k; paren--; }
    else if (ch === ']') { if (square === 0) return k; square--; }
  }
  return run.length;
}
/** Glue: a token touching one of these (the shortcode alphabet) is part of something longer and stays literal. */
const WORD_CHAR = /[A-Za-z0-9_+-]/;

/** The text as plain / emoji segments (one plain segment when nothing matches; never an empty segment). */
export function renderChatEmoji(text: string): ChatEmojiSegment[] {
  if (!text || text.indexOf(':') < 0) return text ? [{ t: text }] : [];
  const urls: [number, number][] = [];
  // Astra 10-16: scanning resumes where a shortened run ends, so a second link after a wrapper is protected too.
  URL_RUN.lastIndex = 0;
  for (let u = URL_RUN.exec(text); u; u = URL_RUN.exec(text)) {
    const end = u.index + Math.max(1, urlEnd(u[0], text[u.index - 1] === "'"));
    urls.push([u.index, end]);
    URL_RUN.lastIndex = end;
  }
  const inUrl = (a: number, b: number) => urls.some(([s, e]) => a < e && b > s);
  const out: ChatEmojiSegment[] = [];
  let plainFrom = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    const emoji = CHAT_EMOJI.get(m[1]!.toLowerCase());
    const before = text[start - 1];
    const after = text[end];
    const whole = !(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after));
    if (!emoji || !whole || inUrl(start, end)) {
      TOKEN.lastIndex = start + 1; // the closing colon may open the next token (":foo:joy:")
      continue;
    }
    if (start > plainFrom) out.push({ t: text.slice(plainFrom, start) });
    out.push({ t: emoji, emoji: true, code: m[0] });
    plainFrom = end;
  }
  if (plainFrom < text.length) out.push({ t: text.slice(plainFrom) });
  return out;
}
