import { type JSX, mergeProps } from "solid-js";

export function UserSolid(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  const merged = mergeProps(
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "1em",
      height: "1em",
      viewBox: "0 0 16 16",
    },
    props,
  );

  return (
    <svg {...merged}>
      <title>user-solid</title>
      <path
        fill="currentColor"
        d="M7.5 0a3.499 3.499 0 1 0 0 6.996A3.499 3.499 0 1 0 7.5 0m-2 8.994a3.5 3.5 0 0 0-3.5 3.5v2.497h11v-2.497a3.5 3.5 0 0 0-3.5-3.5z"
      />
    </svg>
  );
}
export default UserSolid;
