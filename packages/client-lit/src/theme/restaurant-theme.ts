const restaurantBackground = `radial-gradient(
    at 0% 0%,
    light-dark(rgba(161, 196, 253, 0.3), rgba(6, 182, 212, 0.15)) 0px,
    transparent 50%
  ),
  radial-gradient(
    at 100% 0%,
    light-dark(rgba(255, 226, 226, 0.3), rgba(59, 130, 246, 0.15)) 0px,
    transparent 50%
  ),
  radial-gradient(
    at 100% 100%,
    light-dark(rgba(162, 210, 255, 0.3), rgba(20, 184, 166, 0.15)) 0px,
    transparent 50%
  ),
  radial-gradient(
    at 0% 100%,
    light-dark(rgba(255, 200, 221, 0.3), rgba(99, 102, 241, 0.15)) 0px,
    transparent 50%
  ),
  linear-gradient(
    120deg,
    light-dark(#f0f4f8, #0f172a) 0%,
    light-dark(#e2e8f0, #1e293b) 100%
  )`;

export const restaurantThemeSheet = new CSSStyleSheet();
restaurantThemeSheet.replaceSync(`
:root {
  --background: ${restaurantBackground};

  --a2ui-button-background: linear-gradient(135deg, light-dark(var(--p-70), var(--p-40)) 0%, light-dark(var(--p-60), var(--p-30)) 100%);
  --a2ui-button-box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  --a2ui-button-font-weight: 500;
  --a2ui-button-border-radius: 9999px;

  --a2ui-text-a-color: var(--e-40, red);
  --a2ui-text-a-font-weight: bold;

  --a2ui-card-border: none;
  --a2ui-card-border-radius: 24px;
  --a2ui-card-background: radial-gradient(circle at top left, light-dark(transparent, rgba(6, 182, 212, 0.15)), transparent 40%), radial-gradient(circle at bottom right, light-dark(transparent, rgba(139, 92, 246, 0.15)), transparent 40%), linear-gradient(135deg, light-dark(rgba(255, 255, 255, 0.7), rgba(30, 41, 59, 0.7)), light-dark(rgba(255, 255, 255, 0.7), rgba(15, 23, 42, 0.8)));

  --a2ui-image-border-radius: 12px;

  --a2ui-checkbox-label-font-size: 0.875rem;
  --a2ui-checkbox-background: light-dark(var(--n-100), var(--n-20));
  --a2ui-checkbox-border: 1px solid light-dark(var(--p-60), var(--p-40));

  --a2ui-choicepicker-gap: 0.5rem;
  --a2ui-choicepicker-padding: 0.5rem;
  --a2ui-choicepicker-label-color: light-dark(var(--n-20), var(--n-90));
  --a2ui-choicepicker-label-font-size: 0.875rem;

  --a2ui-datetimeinput-background: light-dark(var(--n-100), var(--n-20));
  --a2ui-datetimeinput-border: 1px solid light-dark(var(--n-80), var(--n-30));
  --a2ui-datetimeinput-padding: 0.5rem;

  --a2ui-list-padding: 0.5rem;

  --a2ui-slider-track-margin: 0.25rem 0;
  --a2ui-slider-thumb-margin: -0.25rem 0;
}
`);
