/**
 * The Login screen's brand row: the 46px logo disc, the app name and the tagline.
 *
 * Prototype:
 *   <div class="avatar" style="width:46px;height:46px;font-size:20px">◈</div>
 *   <div>Firon Performance</div><div class="sub">Train. Track. Transform.</div>
 *
 * The mark itself is the CMS `common.logo` image when one is uploaded; the lime gradient disc
 * with the `◈` glyph is the fallback, so the screen looks right before any media exists.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FP_Avatar, FP_CmsImage, FP_CmsText, FP_Row } from '../../../components';
import { useContent } from '../../../cms/ContentProvider';
import { FP_COLORS } from '../../../theme';

const LOGO_PX = 46;

export const FP_AuthBrand: React.FC = () => {
  const { media } = useContent();
  const hasLogo = Boolean(media('common.logo'));

  return (
    <FP_Row gap={10} align="center">
      {hasLogo ? (
        <FP_CmsImage
          k="common.logo"
          width={LOGO_PX}
          height={LOGO_PX}
          radius={LOGO_PX / 2}
          resizeMode="cover"
        />
      ) : (
        <FP_Avatar size={LOGO_PX} glyph={<Text style={styles.glyph}>◈</Text>} />
      )}
      <View style={styles.grow}>
        <FP_CmsText k="common.app_name" style={styles.name} numberOfLines={1} />
        <FP_CmsText k="common.app_tagline" variant="sub" numberOfLines={1} />
      </View>
    </FP_Row>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  glyph: { fontSize: 20, color: FP_COLORS.onAccent, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: FP_COLORS.text },
});

export default FP_AuthBrand;
