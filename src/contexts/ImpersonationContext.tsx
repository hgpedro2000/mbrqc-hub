import { createContext, useContext, useState, ReactNode } from "react";

interface ImpersonatedUser {
  id: string;
  full_name: string;
  employee_number: string;
  turno: string | null;
  empresa: string | null;
  empresa_terceira: string | null;
}

interface ImpersonationContextType {
  impersonating: ImpersonatedUser | null;
  setImpersonating: (user: ImpersonatedUser | null) => void;
  stopImpersonating: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonating: null,
  setImpersonating: () => {},
  stopImpersonating: () => {},
});

export const useImpersonation = () => useContext(ImpersonationContext);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [impersonating, setImpersonating] = useState<ImpersonatedUser | null>(null);

  const stopImpersonating = () => setImpersonating(null);

  return (
    <ImpersonationContext.Provider value={{ impersonating, setImpersonating, stopImpersonating }}>
      {children}
    </ImpersonationContext.Provider>
  );
};
