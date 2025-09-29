import 'package:get/get.dart';

class AppTranslations extends Translations {
  @override
  Map<String, Map<String, String>> get keys => {
        'en_US': {
          'New': 'New',
          'Refresh': 'Refresh',
          'Search': 'Search',
          'Rows per page:': 'Rows per page:',
          'Previous': 'Previous',
          'Next': 'Next',
          'Delete': 'Delete',
          'Are you sure?': 'Are you sure?',
          'Error': 'Error',
          'Success': 'Success',
          'error.saveParentFirst':
              'Save the @parent before creating related @child',
          'Create MediaAssets': 'Create Media Assets',
          'Create Properties': 'Create Properties',
          'Edit Properties': 'Edit Properties',
        },
      };
}
