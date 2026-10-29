# 시크릿 팩 이미지 제작 기록

## 카드 꾸러미

파일: `assets/secret-box.png` — 1254 × 1254 RGBA PNG. 내장 `image_gen.imagegen`, `transparent_background: true`로 생성하고 수정 없이 사용했습니다.

최종 프롬프트:

> A production-ready isolated 3D game shop product asset, genuinely transparent background. ONE sealed collectible trading-card booster display BOX, three-quarter front view with the left side visible, positioned upright. The front face is a tall rectangular face; the box has real depth about 40 percent of its width, like a Japanese Pokemon trading card retail booster box but with an entirely original abstract design and NO Pokemon branding. This is the outer box that contains individually wrapped mystery booster packs, not a card itself. A dramatic premium black metallic cardboard box, gold foil printing, blue-violet cosmic star maps, intricate gold celestial circular sigil with a radiant four-point golden star and a question mark in its center. Small shrink-wrap seams and subtle realistic specular creases for an unopened new product. Large sharp exact gold serif title 'CHIIKAWA' across upper front, exact subtitle 'SECRET PACK', small 'SSS' at bottom, tiny 'BOOSTER BOX' on the upper side. The front and side should use midnight black, luminous warm gold, iridescent purple-blue details. NO characters, NO animal silhouettes, NO revealed cards, no hints to card identities. Cohesive mysterious cosmic collectible-pack design. Professional high quality photoreal 3D product render, clear front and left faces and slight top visible. Whole box visible, centered, filling 85 percent of a square image canvas, leave modest transparent margin around it. No floor, no cast shadow outside silhouette, no surrounding glow, no scene, no environment, no additional objects. Preserve true alpha transparency around the box.

## 개별 카드팩

파일: `assets/secret-pack.png` — 948 × 1659 RGBA PNG.

제작 방법: 내장 `image_gen.imagegen`, `transparent_background: true`. 생성 결과를 그대로 복사해 사용했고, 원본 카드 그림은 수정하지 않았습니다. 포장지 분리와 찢김은 CSS clip-path 및 transform으로 처리합니다.

최종 프롬프트:

> Create a production-ready isolated game asset: ONE sealed trading-card booster foil wrapper, upright and front-facing, no perspective, centered and filling nearly the full height, full object visible, on a genuinely transparent background. A tactile, premium Japanese collectible-card packet, aspect ratio of the packet about 0.57 wide to 1 tall. Photoreal metallic midnight-black foil with rich gold, iridescent violet and blue fine highlights, visible realistic foil wrinkles, silver-gold vertically ribbed crimp seals across top and bottom, sharp square corners. The outer silhouette should be nearly rectangular, not a rounded playing card. Artwork on wrapper is abstract: a radiant golden four-point star in an intricate celestial magic-circle medallion, tiny constellations, luminous arcs and shards. NO characters, no animal silhouettes, no visible collectible cards, no specific card previews, no Pokemon logo. Large crisp gold-embossed exact title 'CHIIKAWA' at upper third, small exact subtitle 'SECRET PACK' below, and a tiny 'SSS' near bottom. A small mystery question mark inside the radiant central medallion. Design should feel mysterious, powerful and physical, like a real unopened booster pack suspended in space. Keep the top 12 percent as uninterrupted crimped sealed header that will be torn off by web animation, with all text/art below that. Neutral studio product lighting with luminous golden highlights on the foil, no external glow beyond silhouette, no shadow outside the object, no scenery or floor, no mockup surroundings, no extra objects. Output transparent PNG.
