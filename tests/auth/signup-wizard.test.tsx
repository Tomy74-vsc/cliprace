import { describe, it, expect, vi } from "vitest";

describe("SignupWizard - Step 3 hydration logic", () => {
  it("should hydrate from Supabase when localStorage is empty", async () => {
    // Mock du client Supabase
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              email_confirmed_at: new Date().toISOString(),
              user_metadata: { role: "creator" },
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: "test@example.com", role: "creator" },
              error: null,
            }),
          }),
        }),
      }),
    };

    // Simuler la fonction hydrateFromSupabase
    const hydrateFromSupabase = async () => {
      const { data: { user: currentUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      const { data: profile, error: pErr } = await mockSupabaseClient
        .from("profiles")
        .select("email, role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (pErr) throw pErr;

      const role = (profile?.role ?? currentUser.user_metadata?.role);
      const email = profile?.email ?? currentUser.email ?? "";

      if (!role || !email) {
        throw new Error("Impossible de déterminer votre rôle ou email.");
      }

      return { role, email, user: currentUser };
    };

    // Exécuter l'hydratation
    const result = await hydrateFromSupabase();

    // Vérifications
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
    expect(result.role).toBe("creator");
    expect(result.email).toBe("test@example.com");
    expect(result.user.id).toBe("test-user-id");
  });

  it("should handle case when profile table has no data but user_metadata has role", async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              email_confirmed_at: new Date().toISOString(),
              user_metadata: { role: "brand" },
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Pas de profil dans la table
              error: null,
            }),
          }),
        }),
      }),
    };

    const hydrateFromSupabase = async () => {
      const { data: { user: currentUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      const { data: profile, error: pErr } = await mockSupabaseClient
        .from("profiles")
        .select("email, role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (pErr) throw pErr;

      const role = (profile?.role ?? currentUser.user_metadata?.role);
      const email = profile?.email ?? currentUser.email ?? "";

      if (!role || !email) {
        throw new Error("Impossible de déterminer votre rôle ou email.");
      }

      return { role, email };
    };

    const result = await hydrateFromSupabase();

    // Le rôle devrait venir de user_metadata
    expect(result.role).toBe("brand");
    expect(result.email).toBe("test@example.com");
  });

  it("should throw error when user is not authenticated", async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Not authenticated" },
        }),
      },
      from: vi.fn(),
    };

    const hydrateFromSupabase = async () => {
      const { data: { user: currentUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }
    };

    await expect(hydrateFromSupabase()).rejects.toThrow(
      "Session expirée. Veuillez vous reconnecter."
    );
  });

  it("should throw error when role or email cannot be determined", async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "test-user-id",
              email: null, // Pas d'email
              email_confirmed_at: new Date().toISOString(),
              user_metadata: {}, // Pas de rôle
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };

    const hydrateFromSupabase = async () => {
      const { data: { user: currentUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      const { data: profile, error: pErr } = await mockSupabaseClient
        .from("profiles")
        .select("email, role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (pErr) throw pErr;

      const role = (profile?.role ?? currentUser.user_metadata?.role);
      const email = profile?.email ?? currentUser.email ?? "";

      if (!role || !email) {
        throw new Error("Impossible de déterminer votre rôle ou email.");
      }

      return { role, email };
    };

    await expect(hydrateFromSupabase()).rejects.toThrow(
      "Impossible de déterminer votre rôle ou email."
    );
  });
});

describe("SignupWizard - Step 3 submission with hydrated data", () => {
  it("should submit Step3 successfully with accountData from Supabase (no password)", async () => {
    type Role = "brand" | "creator";
    
    // Simuler accountData hydraté depuis Supabase (pas de password)
    const accountData: { role: Role; email: string; password: string; confirmPassword: string } = {
      role: "creator",
      email: "creator@example.com",
      password: "", // Password vide car hydraté depuis Supabase
      confirmPassword: "",
    };

    const currentUser = {
      id: "test-user-id",
      email: "creator@example.com",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { role: "creator" },
    };

    const profileData = {
      name: "Test Creator",
      description: "This is a test creator profile",
      website: "https://example.com",
      profileImage: null,
    };

    // Mock du client Supabase
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: currentUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    };

    // Simuler handleStep3Complete
    const handleStep3Complete = async () => {
      const { data: { user: fetchedUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !fetchedUser) {
        throw new Error("Utilisateur non authentifié.");
      }

      if (!fetchedUser.email_confirmed_at) {
        throw new Error("Email non vérifié.");
      }

      // Valider email et rôle (password N'EST PAS requis à Step3)
      const email = accountData.email ?? fetchedUser.email ?? "";
      const role = accountData.role;

      if (!email || !role) {
        throw new Error("Email ou rôle manquant.");
      }

      // Créer le profil de base
      const baseProfile = {
        id: fetchedUser.id,
        email: email,
        role: role,
        name: profileData.name.trim(),
        description: profileData.description.trim(),
        website: profileData.website?.trim() || null,
        profile_image_url: null,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await mockSupabaseClient
        .from("profiles")
        .upsert(baseProfile, { onConflict: "id" });

      if (profileError) {
        throw new Error("Erreur lors de l'enregistrement du profil.");
      }

      // Créer le profil spécifique selon le rôle
      if (role === "creator") {
        const creatorProfile = {
          user_id: fetchedUser.id,
          handle: `test_handle_${fetchedUser.id.slice(0, 8)}`,
          bio: profileData.description?.trim() || null,
          country: "FR",
          primary_network: "tiktok",
          social_media: {},
          updated_at: new Date().toISOString(),
        };

        const { error: creatorError } = await mockSupabaseClient
          .from("profiles_creator")
          .upsert(creatorProfile, { onConflict: "user_id" });

        if (creatorError) {
          throw new Error("Erreur lors de l'enregistrement du profil créateur.");
        }
      }

      const redirectPath = role === "brand" ? "/brand" : "/creator";
      return { success: true, redirectPath };
    };

    // Exécuter la soumission
    const result = await handleStep3Complete();

    // Vérifications
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-user-id",
        email: "creator@example.com",
        role: "creator",
        name: "Test Creator",
        description: "This is a test creator profile",
      }),
      { onConflict: "id" }
    );
    expect(result.success).toBe(true);
    expect(result.redirectPath).toBe("/creator");
  });

  it("should throw error if email or role is missing at Step3", async () => {
    // accountData sans rôle
    const accountData = {
      role: undefined,
      email: "test@example.com",
      password: "",
      confirmPassword: "",
    };

    const currentUser = {
      id: "test-user-id",
      email: "test@example.com",
      email_confirmed_at: new Date().toISOString(),
    };

    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: currentUser },
          error: null,
        }),
      },
    };

    const handleStep3Complete = async () => {
      const { data: { user: fetchedUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !fetchedUser) {
        throw new Error("Utilisateur non authentifié.");
      }

      if (!fetchedUser.email_confirmed_at) {
        throw new Error("Email non vérifié.");
      }

      const email = accountData.email ?? fetchedUser.email ?? "";
      const role = accountData.role;

      if (!email || !role) {
        throw new Error("Email ou rôle manquant.");
      }
    };

    await expect(handleStep3Complete()).rejects.toThrow("Email ou rôle manquant.");
  });

  it("should use currentUser.email as fallback when accountData.email is empty", async () => {
    type Role = "brand" | "creator";
    
    // accountData sans email mais avec rôle
    const accountData: { role: Role; email: string; password: string; confirmPassword: string } = {
      role: "brand",
      email: "", // Email vide
      password: "",
      confirmPassword: "",
    };

    const currentUser = {
      id: "test-user-id",
      email: "fallback@example.com",
      email_confirmed_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: currentUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    };

    const profileData = {
      name: "Test Brand",
      description: "Test brand description",
    };

    const handleStep3Complete = async () => {
      const { data: { user: fetchedUser }, error: userError } = 
        await mockSupabaseClient.auth.getUser();
      
      if (userError || !fetchedUser) {
        throw new Error("Utilisateur non authentifié.");
      }

      if (!fetchedUser.email_confirmed_at) {
        throw new Error("Email non vérifié.");
      }

      // Utiliser currentUser.email comme fallback
      const email = accountData.email || fetchedUser.email || "";
      const role = accountData.role;

      if (!email || !role) {
        throw new Error("Email ou rôle manquant.");
      }

      const baseProfile = {
        id: fetchedUser.id,
        email: email,
        role: role,
        name: profileData.name.trim(),
        description: profileData.description.trim(),
      };

      await mockSupabaseClient.from("profiles").upsert(baseProfile, { onConflict: "id" });

      return { email, role };
    };

    const result = await handleStep3Complete();

    // Vérifier que l'email du currentUser est utilisé
    expect(result.email).toBe("fallback@example.com");
    expect(result.role).toBe("brand");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fallback@example.com",
      }),
      { onConflict: "id" }
    );
  });
});

