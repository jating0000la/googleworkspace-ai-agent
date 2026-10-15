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
