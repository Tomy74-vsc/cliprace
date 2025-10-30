"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Mail, Smartphone, Monitor, Save, AlertCircle } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotifications";

export function NotificationPreferences() {
  const { preferences, loading, error, updatePreferences } = useNotificationPreferences();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      await updatePreferences(preferences);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveError('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Error loading preferences</span>
        </div>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Bell className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Notification Preferences
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose how you want to receive notifications
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border border-green-200 rounded-lg"
        >
          <div className="flex items-center gap-2 text-green-800">
            <Save className="h-5 w-5" />
            <span className="font-medium">Preferences saved successfully!</span>
          </div>
        </motion.div>
      )}

      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error saving preferences</span>
          </div>
          <p className="mt-1 text-sm text-red-600">{saveError}</p>
        </motion.div>
      )}

      {/* Notification Types */}
      <div className="space-y-4">
        {/* Email Notifications */}
        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Email Notifications
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.email_notifications}
                onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle email notifications"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Push Notifications
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Receive push notifications on your device
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.push_notifications}
                onChange={(e) => handlePreferenceChange('push_notifications', e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle push notifications"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Monitor className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  In-App Notifications
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Show notifications in the app interface
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.in_app_notifications}
                onChange={(e) => handlePreferenceChange('in_app_notifications', e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle in-app notifications"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>

      {/* Info Section */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
        <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          About Notifications
        </h4>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
          <li>• <strong>Email:</strong> Receive notifications via email for important updates</li>
          <li>• <strong>Push:</strong> Get instant notifications on your device (requires browser permission)</li>
          <li>• <strong>In-App:</strong> See notifications in the app header and notification center</li>
        </ul>
      </div>
    </div>
  );
}
