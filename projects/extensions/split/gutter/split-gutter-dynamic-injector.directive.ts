import {
  Injector,
  Directive,
  ViewContainerRef,
  TemplateRef,
  input,
  effect,
  inject,
} from '@angular/core';
import { MTX_GUTTER_NUM_TOKEN } from './gutter-num-token';

interface SplitGutterDynamicInjectorTemplateContext {
  $implicit: Injector;
}

/**
 * This directive allows creating a dynamic injector inside ngFor
 * with dynamic gutter num and expose the injector for ngTemplateOutlet usage
 */
@Directive({
  selector: '[mtx-split-gutter-dynamic-injector]',
  standalone: true,
})
export class MtxSplitGutterDynamicInjectorDirective {
  private readonly vcr = inject(ViewContainerRef);
  private readonly templateRef =
    inject<TemplateRef<SplitGutterDynamicInjectorTemplateContext>>(TemplateRef);

  readonly gutterNum = input.required<number>({ alias: 'mtx-split-gutter-dynamic-injector' });

  constructor() {
    effect(() => {
      this.vcr.clear();

      const injector = Injector.create({
        providers: [
          {
            provide: MTX_GUTTER_NUM_TOKEN,
            useValue: this.gutterNum(),
          },
        ],
        parent: this.vcr.injector,
      });

      this.vcr.createEmbeddedView(this.templateRef, { $implicit: injector });
    });
  }

  static ngTemplateContextGuard(
    _dir: MtxSplitGutterDynamicInjectorDirective,
    ctx: unknown
  ): ctx is SplitGutterDynamicInjectorTemplateContext {
    return true;
  }
}
