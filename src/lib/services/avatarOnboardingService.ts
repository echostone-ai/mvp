import { supabase } from '@/lib/supabase';
import { MemoryInjectionService } from './memoryInjectionService';

export interface AvatarOnboardingData {
  name: string;
  speaking_style?: string;
  catchphrases?: string[];
  expressions?: string[];
  address_terms?: {
    male_friend?: string[];
  };
  core_facts?: Array<{
    key: string;
    value: string;
    priority?: number;
  }>;
}

/**
 * Service for onboarding new avatars with catchphrases and expressions
 */
export class AvatarOnboardingService {
  /**
   * Create a new avatar with style and expression setup
   */
  static async createAvatarWithStyle(
    onboardingData: AvatarOnboardingData,
    userId: string = 'demo'
  ): Promise<{ avatarId: string; success: boolean; errors: string[]; warnings: string[]; factCount: number }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let factCount = 0;
    
    try {
      // Create avatar profile
      const avatarId = await this.createAvatarProfile(onboardingData, userId);
      
      // Prepare all facts for validation and storage
      const allFacts: Array<{ key: string; value: string; priority?: number; confidence?: number; category?: string }> = [];

      // Add core facts if provided
      if (onboardingData.core_facts && onboardingData.core_facts.length > 0) {
        allFacts.push(...onboardingData.core_facts);
      }

      // Add style facts
      const styleFacts = this.prepareStyleFacts(onboardingData);
      allFacts.push(...styleFacts);

      // Validate all facts before storing
      const validation = MemoryInjectionService.validateOnboardingFacts(allFacts);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);

      if (validation.errors.length > 0) {
        return { 
          avatarId, 
          success: false, 
          errors, 
          warnings,
          factCount: 0
        };
      }

      // Store all validated facts
      if (validation.categorizedFacts.length > 0) {
        const { errors: storeErrors, storedCount } = await MemoryInjectionService.batchStoreFacts(
          avatarId,
          validation.categorizedFacts,
          'manual',
          'onboarding_setup'
        );
        errors.push(...storeErrors);
        factCount = storedCount;
      }

      // Verify facts are immediately available for conversation
      const { context, factCount: verifyCount, errors: contextErrors } = 
        await MemoryInjectionService.prepareOnboardingContext(avatarId, onboardingData);
      
      errors.push(...contextErrors);
      
      if (verifyCount === 0) {
        warnings.push('No facts were successfully stored - first conversation may not be personalized');
      } else if (verifyCount < factCount) {
        warnings.push(`Only ${verifyCount} of ${factCount} facts are available for conversation`);
      }

      return { 
        avatarId, 
        success: errors.length === 0, 
        errors, 
        warnings,
        factCount: verifyCount
      };
    } catch (error) {
      console.error('Error creating avatar with style:', error);
      return { 
        avatarId: '', 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        factCount: 0
      };
    }
  }

  /**
   * Create avatar profile in database
   */
  private static async createAvatarProfile(
    data: AvatarOnboardingData,
    userId: string
  ): Promise<string> {
    const slug = data.name.toLowerCase().replace(/\s+/g, '_');
    
    // Try avatar_profiles table first (preferred)
    try {
      const { data: profile, error } = await supabase
        .from('avatar_profiles')
        .insert({
          name: slug,
          display_name: data.name,
          user_id: userId,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      return profile.id;
    } catch (error) {
      console.warn('Failed to create in avatar_profiles, trying avatars table:', error);
    }

    // Fallback to avatars table
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .insert({
        slug,
        display_name: data.name,
        status: 'active'
      })
      .select('id')
      .single();

    if (avatarError) {
      throw new Error(`Failed to create avatar: ${avatarError.message}`);
    }

    return avatar.id;
  }

  /**
   * Prepare style-related facts for validation and storage
   */
  private static prepareStyleFacts(
    data: AvatarOnboardingData
  ): Array<{ key: string; value: string; priority: number; category: string }> {
    const styleFacts: Array<{ key: string; value: string; priority: number; category: string }> = [];

    // Speaking style - highest priority for personality
    if (data.speaking_style) {
      styleFacts.push({
        key: 'speaking_style',
        value: data.speaking_style,
        priority: 1,
        category: 'style'
      });
    }

    // Male friend address terms
    if (data.address_terms?.male_friend && data.address_terms.male_friend.length > 0) {
      styleFacts.push({
        key: 'address_male_friend',
        value: data.address_terms.male_friend.join(' | '),
        priority: 4,
        category: 'style'
      });
    }

    // Expressions - limit to prevent overwhelming the context
    if (data.expressions && data.expressions.length > 0) {
      // Only store up to 5 expressions to keep context manageable
      const limitedExpressions = data.expressions.slice(0, 5);
      limitedExpressions.forEach((expression) => {
        const key = `expression_${this.slugify(expression)}`;
        styleFacts.push({
          key,
          value: expression,
          priority: 4,
          category: 'style'
        });
      });

      // If there are more expressions, store them as a combined fact
      if (data.expressions.length > 5) {
        styleFacts.push({
          key: 'additional_expressions',
          value: data.expressions.slice(5).join(' | '),
          priority: 5,
          category: 'style'
        });
      }
    }

    // Catchphrases - limit to prevent overwhelming the context
    if (data.catchphrases && data.catchphrases.length > 0) {
      // Only store up to 5 catchphrases to keep context manageable
      const limitedCatchphrases = data.catchphrases.slice(0, 5);
      limitedCatchphrases.forEach((catchphrase) => {
        const key = `catchphrase_${this.slugify(catchphrase)}`;
        styleFacts.push({
          key,
          value: catchphrase,
          priority: 4,
          category: 'style'
        });
      });

      // If there are more catchphrases, store them as a combined fact
      if (data.catchphrases.length > 5) {
        styleFacts.push({
          key: 'additional_catchphrases',
          value: data.catchphrases.slice(5).join(' | '),
          priority: 5,
          category: 'style'
        });
      }
    }

    return styleFacts;
  }

  /**
   * Store style-related facts (expressions, catchphrases, etc.)
   * @deprecated Use prepareStyleFacts and batch storage instead
   */
  private static async storeStyleFacts(
    avatarId: string,
    data: AvatarOnboardingData
  ): Promise<void> {
    const styleFacts = this.prepareStyleFacts(data);

    // Store all style facts
    if (styleFacts.length > 0) {
      await MemoryInjectionService.batchStoreFacts(
        avatarId,
        styleFacts,
        'manual',
        'onboarding'
      );
    }
  }

  /**
   * Update existing avatar with new expressions/catchphrases
   */
  static async updateAvatarStyle(
    avatarSlug: string,
    updates: {
      expressions?: string[];
      catchphrases?: string[];
      address_terms?: { male_friend?: string[] };
    }
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get avatar ID
      const avatarId = await this.getAvatarIdFromSlug(avatarSlug);
      if (!avatarId) {
        throw new Error(`Avatar not found: ${avatarSlug}`);
      }

      const styleFacts: Array<{ key: string; value: string; priority: number }> = [];

      // Update expressions
      if (updates.expressions) {
        // First, remove existing expressions
        await this.removeExistingStyleFacts(avatarId, 'expression_');
        
        // Add new expressions
        updates.expressions.forEach(expression => {
          const key = `expression_${this.slugify(expression)}`;
          styleFacts.push({ key, value: expression, priority: 4 });
        });
      }

      // Update catchphrases
      if (updates.catchphrases) {
        // Remove existing catchphrases
        await this.removeExistingStyleFacts(avatarId, 'catchphrase_');
        
        // Add new catchphrases
        updates.catchphrases.forEach(catchphrase => {
          const key = `catchphrase_${this.slugify(catchphrase)}`;
          styleFacts.push({ key, value: catchphrase, priority: 4 });
        });
      }

      // Update address terms
      if (updates.address_terms?.male_friend) {
        styleFacts.push({
          key: 'address_male_friend',
          value: updates.address_terms.male_friend.join(' | '),
          priority: 4
        });
      }

      // Store updates
      if (styleFacts.length > 0) {
        const { errors: storeErrors } = await MemoryInjectionService.batchStoreFacts(
          avatarId,
          styleFacts,
          'manual',
          'style_update'
        );
        errors.push(...storeErrors);
      }

      return { success: true, errors };
    } catch (error) {
      console.error('Error updating avatar style:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  /**
   * Remove existing style facts by prefix
   */
  private static async removeExistingStyleFacts(
    avatarId: string,
    keyPrefix: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('quick_facts')
        .delete()
        .eq('avatar_id', avatarId)
        .like('key', `${keyPrefix}%`);

      if (error) {
        console.warn(`Failed to remove existing ${keyPrefix} facts:`, error);
      }
    } catch (error) {
      console.warn(`Error removing ${keyPrefix} facts:`, error);
    }
  }

  /**
   * Get avatar ID from slug
   */
  private static async getAvatarIdFromSlug(slug: string): Promise<string | null> {
    try {
      // Try avatar_profiles first
      const { data: prof, error: profErr } = await supabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', slug)
        .single();
      if (!profErr && prof?.id) return prof.id;

      // Fallback to avatars table
      const { data, error } = await supabase
        .from('avatars')
        .select('id')
        .eq('slug', slug)
        .single();
      if (!error && data?.id) return data.id;

      return null;
    } catch (error) {
      console.error('Error getting avatar ID from slug:', error);
      return null;
    }
  }

  /**
   * Create URL-safe slug from text
   */
  private static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Setup Jonathan-demo with his specific expressions and catchphrases
   */
  static async setupJonathanDemo(): Promise<{ success: boolean; errors: string[] }> {
    const jonathanData: AvatarOnboardingData = {
      name: 'jonathan-demo',
      speaking_style: 'Casual, warm, personable with Canadian politeness',
      expressions: [
        'what\'s up?!',
        'it was WILD!',
        'good times!'
      ],
      catchphrases: [
        'man time flies',
        'that\'s a trip',
        'wild!'
      ],
      address_terms: {
        male_friend: ['man', 'my man']
      },
      core_facts: [
        { key: 'full_name', value: 'Jonathan Braden', priority: 1 },
        { key: 'height', value: '6\'7" (very tall)', priority: 2 },
        { key: 'nationality', value: 'Canadian-American', priority: 2 },
        { key: 'current_location', value: 'Sofia, Bulgaria', priority: 2 },
        { key: 'company', value: 'EchoStone.ai (founder)', priority: 2 },
        { key: 'pet_name', value: 'Romeo', priority: 2 },
        { key: 'pet_type', value: 'toy poodle', priority: 3 },
        { key: 'pet_birthday', value: 'Valentine\'s Day 2024', priority: 4 },
        { key: 'pet_description', value: 'Romeo is my toy poodle, born on Valentine\'s Day 2024', priority: 3 },
        { key: 'friend_tyler', value: 'Tyler is a close friend who I\'ve known for years', priority: 4 },
        { key: 'friend_kate', value: 'Kate is a good friend, always fun to catch up with', priority: 4 },
        { key: 'friend_anna', value: 'Anna is a longtime friend, super smart and creative', priority: 4 },
        { key: 'visitor_personalization', value: 'When friends introduce themselves, greet them warmly and mention something specific you know about them', priority: 4 }
      ]
    };

    return await this.createAvatarWithStyle(jonathanData, 'demo');
  }
}