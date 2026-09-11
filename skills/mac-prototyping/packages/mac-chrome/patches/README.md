# `react-resizable-panels@4.12.2` patch

This patch applies to the package's ESM and CJS distributions. It makes split
panel pointer drag use the group's rendered viewport extent as its
percentage-delta denominator. A transformed logical desktop otherwise compares
viewport pointer movement with an untransformed layout extent.

The patch does not change panel constraints, saved layouts, keyboard resizing,
or the installed dependency version. It only changes the denominator used for
an active pointer gesture.

While a pointer gesture is active, the patch tracks the measured relationship
between the group's rendered and logical extents. It cancels only when that
scale changes, which prevents a stale pointer anchor after page zoom or a
presentation-scale change. A logical extent change from nested or simultaneous
split resizing does not cancel the gesture. Removing a group also removes its
active or hover hit regions, so detached cleanup cannot interrupt remaining
mounted groups.

Keep the patch until the installed dependency provides the same behavior and
real pointer checks cover both a scaled logical desktop and browser page zoom.
At that point, remove the `patchedDependencies` entry and this patch together
only after those checks pass against the replacement. No upstream issue is
assumed or recorded here.
