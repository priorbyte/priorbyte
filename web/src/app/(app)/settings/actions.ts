'use server';

import { revalidatePath } from 'next/cache';
import {
  DASHBOARD_WIDGETS,
  mergeDashboardPreferences,
  type DashboardWidget,
} from '@priorbyte/shared/constants';
import { dashboardPreferencesSchema, nicknameSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';

export interface SettingsState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

function isDashboardWidget(value: string): value is DashboardWidget {
  return (DASHBOARD_WIDGETS as readonly string[]).includes(value);
}

export async function updateDashboardSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const rawNickname = String(formData.get('nickname') ?? '').trim();
  const nicknameResult = rawNickname ? nicknameSchema.safeParse(rawNickname) : null;
  if (nicknameResult && !nicknameResult.success) {
    return { status: 'error', message: 'Nickname must be 1-50 characters.' };
  }

  const widgetOrder = formData
    .getAll('widgetOrder')
    .map(String)
    .filter(isDashboardWidget);

  const hiddenWidgets = formData
    .getAll('hiddenWidgets')
    .map(String)
    .filter(isDashboardWidget);

  const knowledgeMapSubjects = formData
    .getAll('knowledgeMapSubjects')
    .map(String)
    .filter(Boolean)
    .slice(0, 3);

  const parsed = dashboardPreferencesSchema.safeParse({
    theme: String(formData.get('theme') ?? 'dark'),
    accentColor: String(formData.get('accentColor') ?? 'cyan'),
    hiddenWidgets,
    widgetOrder: widgetOrder.length ? widgetOrder : [...DASHBOARD_WIDGETS],
    proBannerDismissed: formData.get('showProBanner') === null,
    knowledgeMapSubjects,
    refreshIntervalSeconds: Number(formData.get('refreshIntervalSeconds') ?? 0),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Some of those settings were invalid.' };
  }

  const merged = mergeDashboardPreferences(parsed.data);

  const { error } = await supabase
    .from('profiles')
    .update({
      nickname: rawNickname || null,
      dashboard_preferences: merged,
    })
    .eq('id', user.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { status: 'saved' };
}
