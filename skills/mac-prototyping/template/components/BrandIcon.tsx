import * as simpleIconsNs from "simple-icons";

type SimpleIcon = {
  readonly hex: string;
  readonly path: string;
  readonly slug: string;
  readonly svg: string;
  readonly title: string;
};

function isSimpleIcon(value: unknown): value is SimpleIcon {
  if (typeof value !== "object" || value === null) return false;
  const icon = value as Record<string, unknown>;
  return (
    typeof icon.hex === "string" &&
    typeof icon.path === "string" &&
    typeof icon.slug === "string" &&
    typeof icon.svg === "string" &&
    typeof icon.title === "string"
  );
}

function lookupIcon(slug: string): SimpleIcon | undefined {
  const key = `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const candidate: unknown = Reflect.get(simpleIconsNs, key);
  return isSimpleIcon(candidate) ? candidate : undefined;
}

export type BrandIconProps = {
  /** Render in currentColor instead of the brand color. */
  readonly monochrome?: boolean;
  readonly size?: number;
  /** A Simple Icons slug, e.g. "googledrive", "notion". */
  readonly slug: string;
  /** Accessible name; omitted = decorative (aria-hidden). */
  readonly title?: string;
};

/** Third-party service marks from the `simple-icons` package, rendered as an
 * inline SVG path — committable, no bitmap assets. Unknown slugs render nothing. */
export function BrandIcon({ monochrome = false, size = 16, slug, title }: BrandIconProps) {
  const icon = lookupIcon(slug);
  if (!icon) return null;
  return (
    <svg
      className="brand-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={monochrome ? "currentColor" : `#${icon.hex}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-brand={icon.slug}
    >
      {title ? <title>{title}</title> : null}
      <path d={icon.path} />
    </svg>
  );
}
