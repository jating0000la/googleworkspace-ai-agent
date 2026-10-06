/**
 * Google Slides tools and a small deterministic design engine.
 */

const SLIDE_THEMES = Object.freeze({
  light: Object.freeze({
    background: '#FFFFFF',
    title: '#202124',
    body: '#3C4043',
    accent: '#1A73E8',
    muted: '#5F6368',
    panel: '#F8F9FA'
  }),
  dark: Object.freeze({
    background: '#171717',
    title: '#FFFFFF',
    body: '#E8EAED',
    accent: '#8AB4F8',
    muted: '#BDC1C6',
    panel: '#242424'
  }),
  muxro: Object.freeze({
    background: '#FFFFFF',
    title: '#172554',
    body: '#334155',
    accent: '#F59E0B',
    muted: '#64748B',
    panel: '#F8FAFC'
  }),
  healthcare: Object.freeze({
    background: '#FFFFFF',
    title: '#123B3A',
    body: '#355B5A',
    accent: '#2A9D8F',
    muted: '#6B8584',
    panel: '#F1F8F7'
  })
});

function getSlideTheme_(name) {
  return SLIDE_THEMES[String(name || 'light').toLowerCase()] || SLIDE_THEMES.light;
}

function setShapeText_(shape, text, style) {
  const range = shape.getText();
  range.setText(String(text || ''));
  const textStyle = range.getTextStyle();
  textStyle.setFontFamily(style.fontFamily || 'Arial');
  if (style.fontSize) textStyle.setFontSize(style.fontSize);
  if (style.color) textStyle.setForegroundColor(style.color);
  if (style.bold !== undefined) textStyle.setBold(Boolean(style.bold));
  return shape;
}

function insertTextBox_(slide, text, x, y, w, h, style) {
  const shape = slide.insertShape(SlidesApp.ShapeType.TEXT_BOX, x, y, w, h);
  shape.getFill().setTransparent();
  shape.getBorder().setTransparent();
  setShapeText_(shape, text, style || {});
  return shape;
}

function insertPanel_(slide, x, y, w, h, fill) {
  const shape = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  shape.getFill().setSolidFill(fill);
  shape.getBorder().setTransparent();
  return shape;
}

function clearSlide_(slide) {
  slide.getPageElements().forEach(function(el) {
    try { el.remove(); } catch (e) {}
  });
}

function bulletsToText_(bullets) {
  if (!Array.isArray(bullets)) return '';
  return bullets
    .filter(function(v) { return v !== null && v !== undefined && String(v).trim(); })
    .map(function(v) { return '• ' + String(v); })
    .join('\n');
}

function renderSlide_(presentation, slide, spec, themeName) {
  const theme = getSlideTheme_(themeName);
  const width = presentation.getPageWidth();
  const height = presentation.getPageHeight();
  const margin = width * 0.075;
  const type = String(spec.type || 'content').toLowerCase();

  clearSlide_(slide);
  slide.getBackground().setSolidFill(theme.background);

  // Thin accent rule used throughout the deck.
  const accent = insertPanel_(slide, 0, 0, width, 7, theme.accent);
  accent.sendToBack();

  if (type === 'title') {
    insertTextBox_(
      slide,
      spec.title || presentation.getName(),
      margin,
      height * 0.25,
      width - margin * 2,
      height * 0.22,
      { fontSize: 30, color: theme.title, bold: true }
    );
    if (spec.subtitle) {
      insertTextBox_(
        slide,
        spec.subtitle,
        margin,
        height * 0.51,
        width - margin * 2,
        height * 0.16,
        { fontSize: 16, color: theme.muted, bold: false }
      );
    }
    addOptionalImage_(slide, spec.imageUrl, width * 0.73, height * 0.68, width * 0.18, height * 0.20);
    return;
  }

  if (type === 'section') {
    insertPanel_(
      slide,
      margin,
      height * 0.18,
      width * 0.065,
      height * 0.50,
      theme.accent
    );
    insertTextBox_(
      slide,
      spec.title || 'Section',
      margin * 2.0,
      height * 0.28,
      width - margin * 3,
      height * 0.20,
      { fontSize: 28, color: theme.title, bold: true }
    );
    if (spec.subtitle || spec.body) {
      insertTextBox_(
        slide,
        spec.subtitle || spec.body,
        margin * 2.0,
        height * 0.51,
        width - margin * 3,
        height * 0.15,
        { fontSize: 15, color: theme.muted }
      );
    }
    return;
  }

  if (type === 'quote') {
    insertTextBox_(
      slide,
      '“',
      margin,
      height * 0.16,
      width * 0.12,
      height * 0.18,
      { fontSize: 48, color: theme.accent, bold: true }
    );
    insertTextBox_(
      slide,
      spec.body || spec.title || '',
      margin * 1.5,
      height * 0.26,
      width - margin * 3,
      height * 0.36,
      { fontSize: 24, color: theme.title, bold: false }
    );
    if (spec.subtitle) {
      insertTextBox_(
        slide,
        spec.subtitle,
        margin * 1.5,
        height * 0.65,
        width - margin * 3,
        height * 0.10,
        { fontSize: 13, color: theme.muted }
      );
    }
    return;
  }

  if (type === 'closing') {
    insertTextBox_(
      slide,
      spec.title || 'Thank You',
      margin,
      height * 0.30,
      width - margin * 2,
      height * 0.18,
      { fontSize: 30, color: theme.title, bold: true }
    );
    insertTextBox_(
      slide,
      spec.subtitle || spec.body || '',
      margin,
      height * 0.52,
      width - margin * 2,
      height * 0.17,
      { fontSize: 16, color: theme.muted }
    );
    return;
  }

  // Shared title for normal content slides.
  insertTextBox_(
    slide,
    spec.title || '',
    margin,
    height * 0.10,
    width - margin * 2,
    height * 0.13,
    { fontSize: 24, color: theme.title, bold: true }
  );

  if (type === 'two_column') {
    const gap = width * 0.035;
    const colW = (width - margin * 2 - gap) / 2;
    const top = height * 0.29;
    const panelH = height * 0.56;

    insertPanel_(slide, margin, top, colW, panelH, theme.panel);
    insertPanel_(slide, margin + colW + gap, top, colW, panelH, theme.panel);

    insertTextBox_(
      slide,
      spec.leftTitle || '',
      margin + 18,
      top + 18,
      colW - 36,
      38,
      { fontSize: 16, color: theme.title, bold: true }
    );
    insertTextBox_(
      slide,
      bulletsToText_(spec.leftBullets),
      margin + 18,
      top + 65,
      colW - 36,
      panelH - 85,
      { fontSize: 13, color: theme.body }
    );

    insertTextBox_(
      slide,
      spec.rightTitle || '',
      margin + colW + gap + 18,
      top + 18,
      colW - 36,
      38,
      { fontSize: 16, color: theme.title, bold: true }
    );
    insertTextBox_(
      slide,
      bulletsToText_(spec.rightBullets),
      margin + colW + gap + 18,
      top + 65,
      colW - 36,
      panelH - 85,
      { fontSize: 13, color: theme.body }
    );
    return;
  }

  const hasImage = Boolean(spec.imageUrl);
  const contentWidth = hasImage ? width * 0.55 : width - margin * 2;
  const bodyText = spec.body
    ? String(spec.body) + (Array.isArray(spec.bullets) && spec.bullets.length ? '\n\n' : '')
    : '';
  const content = bodyText + bulletsToText_(spec.bullets);

  insertTextBox_(
    slide,
    content,
    margin,
    height * 0.29,
    contentWidth,
    height * 0.56,
    { fontSize: 15, color: theme.body }
  );

  if (hasImage) {
    addOptionalImage_(
      slide,
      spec.imageUrl,
      width * 0.68,
      height * 0.32,
      width * 0.25,
      height * 0.42
    );
  }
}

function addOptionalImage_(slide, imageUrl, x, y, w, h) {
  if (!imageUrl) return;
  try {
    slide.insertImage(String(imageUrl), x, y, w, h);
  } catch (e) {
    // Do not fail an otherwise-valid deck because an external image URL is
    // blocked, expired, or not directly downloadable.
    console.warn('Slide image skipped: ' + normalizeError_(e));
  }
}

function toolSlidesCreateDeck_(args) {
  const title = requireString_(args, 'title');
  if (!Array.isArray(args.slides) || !args.slides.length) {
    throw new Error('slides must be a non-empty array.');
  }
  if (args.slides.length > 40) {
    throw new Error('A single deck call is limited to 40 slides.');
  }

  const presentation = SlidesApp.create(title);
  const slides = presentation.getSlides();
  let slide = slides[0];

  args.slides.forEach(function(spec, index) {
    if (index === 0) {
      slide = slides[0];
    } else {
      slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    }
    renderSlide_(presentation, slide, spec, args.theme || 'light');
  });

  moveCreatedFileIfNeeded_(presentation.getId(), args.folderId);
  presentation.saveAndClose();

  return {
    success: true,
    presentationId: presentation.getId(),
    fileId: presentation.getId(),
    title: title,
    slideCount: args.slides.length,
    url: presentation.getUrl()
  };
}

function toolSlidesAddSlide_(args) {
  const presentationId = requireString_(args, 'presentationId');
  if (!args.slide || typeof args.slide !== 'object') {
    throw new Error('slide must be an object.');
  }

  const presentation = SlidesApp.openById(presentationId);
  const slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  renderSlide_(presentation, slide, args.slide, args.theme || 'light');
  const index = presentation.getSlides().length;
  presentation.saveAndClose();

  return {
    success: true,
    presentationId: presentationId,
    fileId: presentationId,
    title: presentation.getName(),
    slideNumber: index,
    url: presentation.getUrl()
  };
}

function toolSlidesRead_(args) {
  const presentationId = requireString_(args, 'presentationId');
  const maxSlides = clampInt_(args.maxSlides, 1, 60, 30);
  const presentation = SlidesApp.openById(presentationId);
  const slides = presentation.getSlides();
  const output = [];

  for (let i = 0; i < slides.length && i < maxSlides; i++) {
    const texts = [];
    slides[i].getPageElements().forEach(function(el) {
      try {
        if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
          const value = el.asShape().getText().asString().trim();
          if (value) texts.push(value);
        }
      } catch (e) {}
    });
    output.push({ slideNumber: i + 1, text: texts.join('\n') });
  }

  return {
    success: true,
    presentationId: presentationId,
    title: presentation.getName(),
    slides: output,
    totalSlides: slides.length,
    truncated: slides.length > maxSlides,
    url: presentation.getUrl()
  };
}

function toolSlidesReplaceText_(args) {
  const presentationId = requireString_(args, 'presentationId');
  const find = requireString_(args, 'find');
  const replace = String(args.replace === undefined ? '' : args.replace);
  const matchCase = Boolean(args.matchCase);

  const presentation = SlidesApp.openById(presentationId);
  const replacements = presentation.replaceAllText(find, replace, matchCase);
  presentation.saveAndClose();

  return {
    success: true,
    presentationId: presentationId,
    fileId: presentationId,
    title: presentation.getName(),
    replacements: replacements,
    url: presentation.getUrl()
  };
}
