import { createContext, useContext, useState, ReactNode } from "react";

export type PodRole = "AD" | "SAM" | "SA" | "RSM";

interface RoleContextType {
  role: PodRole;
  setRole: (role: PodRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "SAM",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PodRole>("SAM");
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
