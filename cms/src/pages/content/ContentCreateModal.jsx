import { useState } from 'react';
import { CONTENT_TYPES, LOCALES, PLATFORMS } from '../../lib/constants.js';
import {
  FP_Button, FP_Modal, FP_Select, FP_Textarea, FP_Textbox,
} from '../../components/index.ts';

const EMPTY = {
  key: '', type: 'text', group: 'common', screen: '', label: '',
  description: '', locale: 'en', platform: 'mobile', value: '',
};

export default function ContentCreateModal({ open, onClose, onCreate, saving, defaults, groups }) {
  const [form, setForm] = useState({ ...EMPTY, ...defaults });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = (e) => {
    e?.preventDefault?.();
    if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/i.test(form.key.trim())) {
      setError('Key must be dot-separated, e.g. home.greeting_morning');
      return;
    }
    if (!form.label.trim()) { setError('Give the key a human label for editors'); return; }
    setError(null);
    onCreate({ ...form, key: form.key.trim() });
  };

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title="New content key"
      size="md"
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button loading={saving} onPress={submit}>Create key</FP_Button>
        </>
      )}
    >
      <form onSubmit={submit}>
        <div className="grid grid--form">
          <FP_Textbox label="Key" placeholder="home.greeting_morning" value={form.key} onChange={set('key')} autoFocus />
          <FP_Textbox label="Editor label" placeholder="Morning greeting" value={form.label} onChange={set('label')} />
          <FP_Select label="Type" options={CONTENT_TYPES} value={form.type} onChange={set('type')} />
          <FP_Select label="Group" options={groups} value={form.group} onChange={set('group')} />
          <FP_Textbox label="Screen" placeholder="home" value={form.screen} onChange={set('screen')} />
          <FP_Select label="Locale" options={LOCALES} value={form.locale} onChange={set('locale')} />
          <FP_Select label="Platform" options={PLATFORMS} value={form.platform} onChange={set('platform')} />
          <FP_Textbox
            label="Initial value"
            value={form.value}
            onChange={set('value')}
            hint="Media keys can be linked after creation"
          />
        </div>
        <div className="mt3">
          <FP_Textarea
            label="Description (shown to editors)"
            rows={2}
            value={form.description}
            onChange={set('description')}
          />
        </div>
        {error ? <div className="errorbox mt3" role="alert">{error}</div> : null}
      </form>
    </FP_Modal>
  );
}
