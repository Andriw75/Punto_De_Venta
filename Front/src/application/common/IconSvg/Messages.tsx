import { type JSX, mergeProps } from "solid-js";

export function Messages(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  const merged = mergeProps(
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "1em",
      height: "1em",
      viewBox: "0 0 24 24",
    },
    props,
  );

  return (
    <svg {...merged}>
      <title>messages</title>
      <path
        fill="currentColor"
        d="m21 14l-3-3h-7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1zm-7 1v2a1 1 0 0 1-1 1H6l-3 3V11a1 1 0 0 1 1-1h2"
      />
    </svg>
  );
}
export default Messages;
