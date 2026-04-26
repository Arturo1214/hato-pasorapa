import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-form-errors',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule],
  template: `
    @if (firstErrorMessage()) {
      <mat-error>{{ firstErrorMessage() }}</mat-error>
    }
  `,
})
export class FormErrorsComponent {
  readonly control = input.required<AbstractControl>();
  readonly messages = input<Record<string, string>>({});

  firstErrorMessage() {
    const control = this.control();
    if (!control || !control.touched || !control.errors) {
      return null;
    }

    return Object.keys(control.errors)
      .map((key) => this.messages()[key])
      .find(Boolean);
  }
}
