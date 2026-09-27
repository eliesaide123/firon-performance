/* Inline editor for one Content row, matched to the item's `type`. */
import {
  FP_ColorPicker, FP_JsonEditor, FP_MediaRefField, FP_Switch, FP_Textarea, FP_Textbox,
} from '../../components/index.ts';

export default function ContentValueEditor({ item, value, onChange, onPickAsset }) {
  const label = `${item.key} value`;

  switch (item.type) {
    case 'boolean':
      return (
        <FP_Switch
          checked={value === true || value === 'true'}
          onChange={onChange}
          label={value === true || value === 'true' ? 'true' : 'false'}
        />
      );

    case 'number':
      return (
        <FP_Textbox
          type="number"
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );

    case 'color':
      return <FP_ColorPicker value={value ?? ''} onChange={onChange} />;

    case 'richtext':
      return (
        <FP_Textarea
          aria-label={label}
          rows={2}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="cell-textarea"
        />
      );

    case 'json':
      return <FP_JsonEditor compact value={value} onChange={(text) => onChange(text)} />;

    case 'image':
    case 'video':
      return (
        <FP_MediaRefField
          kind={item.type}
          value={value}
          asset={item.asset}
          onChange={onPickAsset}
          placeholder={`No ${item.type} set`}
        />
      );

    default:
      return (
        <FP_Textbox
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.description ?? ''}
        />
      );
  }
}
