import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const BRAND_LOCKUP_SIZE = {
  HERO: 'hero',
  CARD: 'card',
  SIDEBAR: 'sidebar',
  TOOLBAR: 'toolbar',
} as const;

type BrandLockupSize = (typeof BRAND_LOCKUP_SIZE)[keyof typeof BRAND_LOCKUP_SIZE];

const BRAND_LOCKUP_LAYOUT = {
  INLINE: 'inline',
  STACKED: 'stacked',
} as const;

type BrandLockupLayout = (typeof BRAND_LOCKUP_LAYOUT)[keyof typeof BRAND_LOCKUP_LAYOUT];

interface BrandLockupPreset {
  imageSize: number;
}

const BRAND_LOCKUP_PRESET: Record<BrandLockupSize, BrandLockupPreset> = {
  [BRAND_LOCKUP_SIZE.HERO]: { imageSize: 176 },
  [BRAND_LOCKUP_SIZE.CARD]: { imageSize: 92 },
  [BRAND_LOCKUP_SIZE.SIDEBAR]: { imageSize: 52 },
  [BRAND_LOCKUP_SIZE.TOOLBAR]: { imageSize: 36 },
};

@Component({
  selector: 'app-brand-lockup',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="brand-lockup"
      [class.brand-lockup--stacked]="layout() === brandLockupLayout.STACKED"
      [class.brand-lockup--hero]="size() === brandLockupSize.HERO"
    >
      <img
        class="brand-lockup__logo"
        [ngSrc]="logoSrc"
        [width]="preset().imageSize"
        [height]="preset().imageSize"
        [alt]="alt()"
        [priority]="size() === brandLockupSize.HERO"
      />

      <div class="brand-lockup__copy">
        <strong class="brand-lockup__title">{{ title() }}</strong>

        @if (subtitle()) {
          <span class="brand-lockup__subtitle">{{ subtitle() }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    .brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 0.875rem;
      color: inherit;
    }

    .brand-lockup--stacked {
      flex-direction: column;
      text-align: center;
    }

    .brand-lockup__logo {
      display: block;
      object-fit: contain;
      filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.12));
    }

    .brand-lockup__copy {
      display: grid;
      gap: 0.18rem;
    }

    .brand-lockup__title {
      font-size: 1rem;
      line-height: 1.1;
      font-weight: 700;
    }

    .brand-lockup--hero .brand-lockup__title {
      font-size: clamp(1.5rem, 3vw, 2.35rem);
    }

    .brand-lockup__subtitle {
      font-size: 0.88rem;
      line-height: 1.35;
      color: inherit;
      opacity: 0.78;
    }

    .brand-lockup--hero .brand-lockup__subtitle {
      max-width: 28rem;
      font-size: 1rem;
    }
  `,
})
export class BrandLockupComponent {
  readonly brandLockupSize = BRAND_LOCKUP_SIZE;
  readonly brandLockupLayout = BRAND_LOCKUP_LAYOUT;
  readonly logoSrc = '/brand/pasorapa-logo.png';

  readonly size = input<BrandLockupSize>(BRAND_LOCKUP_SIZE.SIDEBAR);
  readonly layout = input<BrandLockupLayout>(BRAND_LOCKUP_LAYOUT.INLINE);
  readonly title = input('Pasorapa Hato');
  readonly subtitle = input<string | null>('Gestión ganadera conectada.');
  readonly alt = input('Logo de Pasorapa Hato');

  readonly preset = computed(() => BRAND_LOCKUP_PRESET[this.size()]);
}
