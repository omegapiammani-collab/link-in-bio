-- Disposable database restore acceptance. No hosted data or actual Storage bytes.
DO $restore$
DECLARE v_owner uuid; v_actor uuid;
BEGIN
  SELECT auth_user_id INTO STRICT v_owner FROM public.owner_config WHERE singleton;
  IF (SELECT count(*) FROM auth.users) <> 2 THEN
    RAISE EXCEPTION 'GoTrue account restoration mismatch';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_owner) THEN
    RAISE EXCEPTION 'restored Owner FK lost its real GoTrue user';
  END IF;
  IF (SELECT count(*) FROM public.pages WHERE slug='real-gotrue-owner')<>1
     OR (SELECT count(*) FROM public.page_drafts WHERE
       page_id=(SELECT id FROM public.pages WHERE slug='real-gotrue-owner')
       AND revision=2)<>1 THEN
     RAISE EXCEPTION 'restored draft or revision does not match original';
  END IF;
  IF (SELECT count(*) FROM public.audit_events
      WHERE entity_id=(SELECT id FROM public.pages WHERE slug='real-gotrue-owner')
        AND event_type in ('page.created','draft.saved')) <> 2 THEN
    RAISE EXCEPTION 'restored audit entries lost';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets
     WHERE id='link-in-bio-media' AND public=false) THEN
    RAISE EXCEPTION 'restored private bucket metadata lost';
  END IF;
  IF (SELECT count(*) FROM storage.objects
     WHERE bucket_id='link-in-bio-media' AND name='backup/recovery-fixture.png')<>1
  THEN RAISE EXCEPTION 'restored private object metadata lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname='link_in_bio_media_owner_read') THEN
    RAISE EXCEPTION 'restored Storage RLS missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='pages'
       AND policyname='owner_only') THEN
    RAISE EXCEPTION 'restored application RLS missing';
  END IF;
END;
$restore$;
select 'PASS: restored GoTrue identities, application drafts/audit, private Storage metadata and RLS' as result;
