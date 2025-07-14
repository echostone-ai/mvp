import React, { useState } from "react";

export const ProfileContext = React.createContext<any>(null);

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  // You can customize the profile data here or pull from props/api as needed
  const [profile, setProfile] = useState<any>(null);

  // For now, provide just profile and setProfile (customize as needed)
  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}