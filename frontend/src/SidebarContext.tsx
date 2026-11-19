import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  toggle: () => {},
  open: () => {},
  close: () => {},
  isMobile: false,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDrawerPath = (pathname: string) =>
    ['/conciertos', '/dj', '/mis-entradas', '/estadisticas-musicales', '/organizador'].some((prefix) =>
      pathname.startsWith(prefix),
    );

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 992 : false));
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (window.innerWidth <= 992 || isDrawerPath(window.location.pathname)) return false;
    const saved = localStorage.getItem('sl_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 992;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      } else {
        const saved = localStorage.getItem('sl_sidebar_open');
        setIsOpen(saved !== null ? saved === 'true' : true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cerrar el drawer al navegar si es mobile o si la ruta usa modo drawer
  useEffect(() => {
    const isDrawerPage = ['/conciertos', '/dj', '/mis-entradas', '/estadisticas-musicales', '/organizador'].some(
      (prefix) => location.pathname.startsWith(prefix),
    );
    if (isMobile || isDrawerPage) {
      setIsOpen(false);
    } else {
      const saved = localStorage.getItem('sl_sidebar_open');
      setIsOpen(saved !== null ? saved === 'true' : true);
    }
  }, [location.pathname, location.search, isMobile]);

  const toggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (!isMobile) {
        try {
          localStorage.setItem('sl_sidebar_open', String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const open = () => {
    setIsOpen(true);
    if (!isMobile) {
      try {
        localStorage.setItem('sl_sidebar_open', 'true');
      } catch {
        // ignore
      }
    }
  };

  const close = () => {
    setIsOpen(false);
    if (!isMobile) {
      try {
        localStorage.setItem('sl_sidebar_open', 'false');
      } catch {
        // ignore
      }
    }
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, open, close, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
