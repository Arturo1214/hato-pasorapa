import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { OfflineBannerComponent } from '../../../core/offline/offline-banner.component';
import { ThemeService } from '../../../core/theme/data-access/theme';
import { HeaderComponent } from './header/header';
import { SidebarComponent } from './sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, MatSidenavModule, RouterOutlet, HeaderComponent, SidebarComponent, OfflineBannerComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly themeService = inject(ThemeService);

  readonly isMobile = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map((result) => result.matches)),
    { initialValue: false }
  );
}
