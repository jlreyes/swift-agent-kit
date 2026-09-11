# `react-resizable-panels@4.12.2` patch

This patch applies to the package's ESM and CJS distributions. It makes split
panel pointer drag use the rendered viewport extent of the group—measured from
its panels' `getBoundingClientRect()` values—as the percentage-delta
denominator. A transformed logical desktop otherwise compares viewport pointer
movement with an untransformed layout extent.

The patch does not change panel constraints, saved layouts, keyboard resizing,
or the installed dependency version. It only changes the denominator used for
an active pointer gesture.

While a pointer gesture is active, the patch compares the recorded rendered
group extent with the current one. If it changes by more than 0.5 rendered
pixels, the gesture is cancelled. This prevents a stale pointer anchor from
being applied after page zoom or a presentation-scale change.

Keep the patch until the installed dependency provides the same behavior and
real pointer checks cover both a scaled logical desktop and browser page zoom.
At that point, remove the `patchedDependencies` entry and this patch together
only after those checks pass against the replacement. No upstream issue is
assumed or recorded here.
