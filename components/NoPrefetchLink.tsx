import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function NoPrefetchLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={props.prefetch ?? false} />;
}
