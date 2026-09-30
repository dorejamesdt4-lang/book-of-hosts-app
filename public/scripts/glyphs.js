// Original line emblems for the Storybook × Arcane collection.
const motifs={
'living-script':'<path d="M22 18h28v32H24c-5 0-7-6-2-9h28M29 25h14M29 31h11M29 37h14"/><path d="m39 48 14-15 3 3-14 15-5 2z"/>',
 theatre:'<path d="M15 21c8 4 16 4 24 0v15c0 10-7 16-12 18-5-2-12-8-12-18z"/><path d="M28 17c8-4 16-4 24 0v15c0 9-5 14-10 17M21 31h4m7 0h3m-14 8q6 6 12 0M36 25h3m7 0h3"/>',
 showbox:'<path d="m17 29 19-7 19 7-19 8zM17 29v19l19 8 19-8V29M36 37v19M36 22v-9m-8 7-5-8m21 8 5-8"/><path d="m36 10 2 5-2 4-2-4z"/>',
 manor:'<path d="M16 52V31l20-16 20 16v21H16M22 27v-9h7M30 52V40a6 6 0 0 1 12 0v12M22 33h4v5h-4m24-5h4v5h-4M36 22v6"/><path d="M12 55h48"/>',
 'mini-games':'<rect x="17" y="22" width="27" height="27" rx="4"/><path d="m39 17 14 4 4 26-9 3"/><circle cx="24" cy="29" r="1.6"/><circle cx="37" cy="29" r="1.6"/><circle cx="30.5" cy="35.5" r="1.6"/><circle cx="24" cy="42" r="1.6"/><circle cx="37" cy="42" r="1.6"/>',
 narrator:'<path d="M29 19a7 7 0 0 1 14 0v18a7 7 0 0 1-14 0zM23 32v5a13 13 0 0 0 26 0v-5M36 50v8m-8 0h16M33 22h6m-6 5h6M17 27v13m38-13v13"/>',
 'character-forge':'<path d="m20 49 13-30 4 17 9 8M16 49q20-9 40 0-20 10-40 0zM40 19l4-7 2 7 7 2-7 2-2 7-4-7-7-2z"/>',
 'game-jester':'<path d="M20 41 17 22l12 9 7-17 7 17 12-9-3 19M20 41q16 8 32 0v9H20zM27 54h18"/><circle cx="17" cy="20" r="3"/><circle cx="36" cy="12" r="3"/><circle cx="55" cy="20" r="3"/><path d="m36 34 3 4-3 4-3-4z"/>',
 'print-preview':'<path d="M24 27V16h24v11M22 47h-6V28h40v19h-6M24 40h24v17H24M29 46h14m-14 5h10"/><circle cx="49" cy="33" r="1"/>',
 'image-tools':'<rect x="17" y="19" width="38" height="34" rx="2"/><path d="m20 47 12-14 8 9 7-8 5 13M27 15v-5m-8 9h-5m39 36v6m4-10h5"/><circle cx="44" cy="27" r="3"/>',
 compiler:'<circle cx="36" cy="36" r="13"/><circle cx="36" cy="36" r="5"/><path d="M36 15v8m0 26v8M15 36h8m26 0h8M21 21l6 6m18 18 6 6M21 51l6-6m18-18 6-6"/>',
 'speech-maker':'<path d="m25 48 22-30 7-2-1 8-24 27-8 4zM28 47l-3-5m6-3 8 1m-3-8 8 1M18 57h31"/>',
 'hosts-wand':'<path d="m19 55 26-30M23 51l-4-4M49 13l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM21 21l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>'
};
export function glyph(id){return `<svg class="arcane-glyph" viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="glyph-ring" cx="36" cy="36" r="32" stroke-width=".7"/><path class="glyph-ticks" d="M36 2v4m0 60v4M2 36h4m60 0h4M12 12l3 3m42 42 3 3M12 60l3-3m42-42 3-3" stroke-width="1"/>${motifs[id]||motifs['hosts-wand']}</svg>`;}
