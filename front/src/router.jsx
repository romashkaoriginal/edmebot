import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState } from "react";

const RouterContext = createContext(null);

function currentLocation() {
  return {
    pathname: window.location.pathname.replace(/\/+$/, "") || "/",
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const onPopState = () => setLocation(currentLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (typeof to === "number") {
      if (to === 0) window.location.reload();
      else window.history.go(to);
      return;
    }
    const target = new URL(String(to), window.location.href);
    const next = `${target.pathname}${target.search}${target.hash}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
    setLocation(currentLocation());
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error("Router components must be rendered inside BrowserRouter");
  return context;
}

// oxlint-disable-next-line react/only-export-components
export function useLocation() {
  return useRouter().location;
}

// oxlint-disable-next-line react/only-export-components
export function useNavigate() {
  return useRouter().navigate;
}

// oxlint-disable-next-line react/only-export-components
export function useSearchParams() {
  const { location, navigate } = useRouter();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = useCallback((next, options) => {
    const value = typeof next === "function" ? next(new URLSearchParams(location.search)) : next;
    const search = value instanceof URLSearchParams ? value.toString() : new URLSearchParams(value).toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, options);
  }, [location.pathname, location.search, navigate]);
  return [params, setParams];
}

export const Link = forwardRef(function Link(
  { to, replace = false, onClick, className = "", children, ...props },
  ref
) {
  const navigate = useNavigate();
  const href = typeof to === "string" ? to : String(to);
  return (
    <a
      {...props}
      ref={ref}
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank"
        ) return;
        event.preventDefault();
        navigate(href, { replace });
      }}
    >
      {children}
    </a>
  );
});

export const NavLink = forwardRef(function NavLink(
  { to, end = false, className = "", children, ...props },
  ref
) {
  const { pathname } = useLocation();
  const targetPath = String(to).split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const active = end
    ? pathname === targetPath
    : pathname === targetPath || (targetPath !== "/" && pathname.startsWith(`${targetPath}/`));
  const resolvedClassName = typeof className === "function"
    ? className({ isActive: active })
    : `${className}${active ? " active" : ""}`.trim();
  return <Link {...props} ref={ref} to={to} className={resolvedClassName}>{children}</Link>;
});

export function Navigate({ to, replace = false }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}
