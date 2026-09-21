"""Fixture-only coverage; never installs Apple content into this checkout."""
import importlib.util
from pathlib import Path
import tempfile
import json
import shutil
import unittest
from unittest import mock

MODULE = Path(__file__).resolve().parents[1] / "skills/apple-api-updates/scripts/extract-apple-skills.py"
spec = importlib.util.spec_from_file_location("apple_installer", MODULE)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def skill(name, description="Official trigger", body="Official body\n"):
    return '---\nname: ' + name + '\ndescription: "' + description + '"\n---\n' + body


def snapshot(root):
    return {str(path.relative_to(root)): path.read_bytes() for path in root.rglob("*") if path.is_file()}


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "export"
        self.docs = self.root / "docs"
        self.docs.mkdir()
        self.skills = self.root / "installed/skills"
        self.skills.mkdir(parents=True)
        for official in installer.SKILLS:
            directory = self.source / "skills" / official
            (directory / "references").mkdir(parents=True)
            (directory / "SKILL.md").write_text(skill(official, "Official " + official, "Use `xcode-integration:translation` and ../modernize-tests/SKILL.md.\n"))
            (directory / "references/guide.md").write_text("Supporting source\n")
        dynamic = self.source / "skills/accessibility-dynamic-type-specialist"
        (dynamic / "references/implementation-guide.md").write_text(skill("ios-dynamic-text", "Legacy implementation", "Implement first. See [UIKit](./uikit-examples.md).\n"))
        (dynamic / "references/uikit-examples.md").write_text("UIKit examples")
        security = self.source / "skills/audit-xcode-security-settings/scripts"
        security.mkdir()
        (security / "filter.py").write_text("print('helper')\n")
        (security / "filter.py").chmod(0o755)
        for _, public in installer.INSTALLS:
            directory = self.skills / public
            directory.mkdir()
            (directory / "SKILL.md").write_text('---\nname: ' + public + '\ndescription: >-\n  Curated trigger for ' + public + '\nmetadata:\n  stub: "true"\n---\nStub\n')
        api = self.skills / "apple-api-updates"
        (api / "references").mkdir(parents=True)
        (api / "SKILL.md").write_text("Kit routing")
        (api / "references/own.md").write_text("Keep this")
        (self.skills / "unrelated.txt").write_text("Do not change")
        for index in range(20):
            (self.docs / (str(index) + ".md")).write_bytes(b"Original documentation\n")

    def install(self):
        installer.install(self.source, self.docs, self.skills, "27A266a")

    def test_complete_flat_install_preserves_augmentations_and_reruns(self):
        self.install()
        self.assertTrue(installer.fresh(self.skills, "27A266a"))
        self.assertFalse(installer.fresh(self.skills, "27A999"))
        translation = (self.skills / "translation/SKILL.md").read_text()
        self.assertIn("Use `translation`", translation)
        self.assertIn("../test-modernizer/SKILL.md", translation)
        self.assertNotIn("xcode-integration:", translation)
        self.assertIn("Curated trigger", translation)
        self.assertIn('when_to_use: "Official translation"', translation)
        self.assertIn('name: "c-bounds-safety"', (self.skills / "c-bounds-safety/SKILL.md").read_text())
        legacy = (self.skills / "ios-dynamic-text/SKILL.md").read_text()
        self.assertIn("Implement first", legacy)
        self.assertIn("references/uikit-examples.md", legacy)
        self.assertIn('when_to_use: "Legacy implementation"', legacy)
        self.assertIn("Official", (self.skills / "accessibility-dynamic-type-specialist/SKILL.md").read_text())
        self.assertTrue((self.skills / "audit-xcode-security-settings/scripts/filter.py").stat().st_mode & 0o100)
        self.assertEqual((self.skills / "apple-api-updates/references/own.md").read_text(), "Keep this")
        self.assertEqual((self.skills / "unrelated.txt").read_text(), "Do not change")
        for document in self.docs.iterdir():
            self.assertEqual(document.read_bytes(), (self.skills / "apple-api-updates/references" / document.name).read_bytes())
        self.install()
        self.assertEqual(translation, (self.skills / "translation/SKILL.md").read_text())

    def test_notes_are_added_once_and_apple_body_retained(self):
        notes = json.loads(MODULE.with_name("integration-notes.json").read_text())
        self.install()
        first = (self.skills / "translation/SKILL.md").read_text()
        self.assertIn(notes["translation"].strip(), first)
        self.assertIn("Use `translation` and ../test-modernizer/SKILL.md.", first)
        self.install()
        self.assertEqual(first, (self.skills / "translation/SKILL.md").read_text())

    def test_missing_reference_marks_install_stale(self):
        self.install()
        (self.skills / "translation/references/guide.md").unlink()
        self.assertFalse(installer.fresh(self.skills, "27A266a"))

    def test_curated_manifest_matches_repository_stubs(self):
        descriptions = json.loads(MODULE.with_name("descriptions.json").read_text())
        for _, public in installer.INSTALLS:
            stub = MODULE.parents[2] / public / "SKILL.md"
            self.assertEqual(descriptions[public], installer.field(installer.frontmatter(stub.read_text())[0], "description")[0])
            self.assertLessEqual(len(descriptions[public]), 1024)

    def test_flat_install_with_only_api_skill(self):
        minimal = self.root / "flat-skills"
        minimal.mkdir()
        shutil.copytree(self.skills / "apple-api-updates", minimal / "apple-api-updates")
        installer.install(self.source, self.docs, minimal, "27A266a")
        self.assertTrue(installer.fresh(minimal, "27A266a"))
        self.assertIn("`translation`", (minimal / "translation/SKILL.md").read_text())

    def test_unexpected_official_skill_fails_before_mutation(self):
        before = snapshot(self.skills)
        (self.source / "skills/new-capability").mkdir()
        with self.assertRaisesRegex(ValueError, "additional skills"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_existing_apple_when_to_use_and_description_both_preserved(self):
        source = self.source / "skills/adopt-c-bounds-safety/SKILL.md"
        source.write_text(source.read_text().replace("---\nOfficial", "when_to_use: Detailed trigger\n---\nOfficial").replace("---\nUse", "when_to_use: Detailed trigger\n---\nUse"))
        self.install()
        header, _ = installer.frontmatter((self.skills / "c-bounds-safety/SKILL.md").read_text())
        self.assertEqual(installer.field(header, "when_to_use")[0], "Detailed trigger")
        self.assertEqual(installer.field(header, "original_description")[0], "Official c-bounds-safety")

    def test_plugin_namespace(self):
        manifest = self.skills.parent / ".claude-plugin/plugin.json"
        manifest.parent.mkdir()
        manifest.write_text('{"name":"swift-agent-kit"}')
        self.install()
        self.assertIn("`swift-agent-kit:translation`", (self.skills / "translation/SKILL.md").read_text())

    def test_missing_last_source_does_not_mutate_any_install(self):
        before = snapshot(self.skills)
        (self.source / "skills/building-document-based-swiftui-applications/SKILL.md").unlink()
        with self.assertRaisesRegex(ValueError, "missing skill"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_malformed_late_frontmatter_does_not_mutate(self):
        before = snapshot(self.skills)
        source = self.source / "skills/building-document-based-swiftui-applications/SKILL.md"
        source.write_text("No frontmatter")
        with self.assertRaisesRegex(ValueError, "frontmatter"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_missing_dynamic_guide_does_not_mutate(self):
        before = snapshot(self.skills)
        (self.source / "skills/accessibility-dynamic-type-specialist/references/implementation-guide.md").unlink()
        with self.assertRaisesRegex(ValueError, "implementation guide"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_missing_documentation_does_not_mutate(self):
        before = snapshot(self.skills)
        (self.docs / "0.md").unlink()
        with self.assertRaisesRegex(ValueError, "20 Xcode"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_failed_swap_rolls_back_existing_marker_and_every_skill(self):
        self.install()
        before = snapshot(self.skills)
        original = Path.rename
        failed = False

        def fail_once(path, target):
            nonlocal failed
            if not failed and path.name == "test-modernizer" and path.parent.name.startswith(".apple-stage-"):
                failed = True
                raise OSError("simulated disk error")
            return original(path, target)

        with mock.patch.object(Path, "rename", fail_once):
            with self.assertRaisesRegex(OSError, "simulated"):
                self.install()
        self.assertTrue(failed)
        self.assertEqual(before, snapshot(self.skills))

    def test_failed_swap_restores_relative_skill_symlink(self):
        target = self.skills / "swiftui-specialist"
        shared = self.root / "shared/swiftui-specialist"
        shared.parent.mkdir()
        target.rename(shared)
        target.symlink_to("../../shared/swiftui-specialist", target_is_directory=True)
        before = (target / "SKILL.md").read_bytes()
        original = Path.rename
        failed = False

        def fail_once(path, destination):
            nonlocal failed
            if not failed and path.name == "test-modernizer" and path.parent.name.startswith(".apple-stage-"):
                failed = True
                raise OSError("simulated later swap error")
            return original(path, destination)

        with mock.patch.object(Path, "rename", fail_once):
            with self.assertRaisesRegex(OSError, "simulated"):
                self.install()
        self.assertTrue(failed)
        self.assertTrue(target.is_symlink())
        self.assertEqual(target.readlink(), Path("../../shared/swiftui-specialist"))
        self.assertEqual(before, (target / "SKILL.md").read_bytes())
        self.assertEqual(before, (shared / "SKILL.md").read_bytes())

    def test_old_schema_and_partial_install_are_stale(self):
        self.install()
        marker = self.skills / installer.MARKER
        current = marker.read_text()
        marker.write_text(current.replace("schema=" + installer.SCHEMA, "schema=1"))
        self.assertFalse(installer.fresh(self.skills, "27A266a"))
        marker.write_text(current)
        (self.skills / "translation/SKILL.md").unlink()
        self.assertFalse(installer.fresh(self.skills, "27A266a"))

    def test_invalid_description_leaves_stubs_untouched(self):
        target = self.skills / "translation/SKILL.md"
        target.write_text(skill("translation", "a" * 1025))
        before = snapshot(self.skills)
        with self.assertRaisesRegex(ValueError, "1024"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_source_checkout_guard(self):
        (self.skills.parent / ".git").mkdir()
        before = snapshot(self.skills)
        with self.assertRaisesRegex(ValueError, "Git checkout"):
            self.install()
        self.assertEqual(before, snapshot(self.skills))

    def test_stale_managed_references_removed(self):
        old = self.skills / "swiftui-specialist/references/obsolete.md"
        old.parent.mkdir()
        old.write_text("obsolete")
        self.install()
        self.assertFalse(old.exists())


if __name__ == "__main__":
    unittest.main()
