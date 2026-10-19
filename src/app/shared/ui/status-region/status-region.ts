import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { StatusService } from './status.service';

/**
 * Shim for grass-ds gap 7 (Toast). The live region is always in the DOM, so a message inserted
 * later is announced. Errors use role="alert", successes role="status".
 */
@Component({
  selector: 'pb-status-region',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="pb-status" [attr.data-kind]="status.message()?.kind" [hidden]="!status.message()">
      <div [attr.role]="status.message()?.kind === 'error' ? 'alert' : 'status'" aria-atomic="true">
        {{ status.message()?.text }}
      </div>
      @if (status.message()) {
        <button type="button" class="pb-status__close" (click)="status.dismiss()">
          {{ 'ui.dismiss' | transloco }}
        </button>
      }
    </div>
  `,
})
export class StatusRegion {
  protected readonly status = inject(StatusService);
}
