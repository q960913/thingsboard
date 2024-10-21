///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Component, Inject, InjectionToken, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import {
  AggregationType,
  DAY,
  HistoryWindowType,
  historyWindowTypeTranslations,
  quickTimeIntervalPeriod,
  RealtimeWindowType,
  realtimeWindowTypeTranslations,
  Timewindow,
  TimewindowType
} from '@shared/models/time/time.models';
import { PageComponent } from '@shared/components/page.component';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { TimeService } from '@core/services/time.service';
import { deepClone, isDefined } from '@core/utils';
import { OverlayRef } from '@angular/cdk/overlay';
import { ToggleHeaderOption } from '@shared/components/toggle-header.component';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import {
  TimewindowConfigDialogComponent,
  TimewindowConfigDialogData
} from '@shared/components/time/timewindow-config-dialog.component';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

export interface TimewindowPanelData {
  historyOnly: boolean;
  forAllTimeEnabled: boolean;
  quickIntervalOnly: boolean;
  timewindow: Timewindow;
  aggregation: boolean;
  timezone: boolean;
  isEdit: boolean;
}

export const TIMEWINDOW_PANEL_DATA = new InjectionToken<any>('TimewindowPanelData');

@Component({
  selector: 'tb-timewindow-panel',
  templateUrl: './timewindow-panel.component.html',
  styleUrls: ['./timewindow-panel.component.scss', './timewindow-form.scss']
})
export class TimewindowPanelComponent extends PageComponent implements OnInit, OnDestroy {

  historyOnly = false;

  forAllTimeEnabled = false;

  quickIntervalOnly = false;

  aggregation = false;

  timezone = false;

  isEdit = false;

  timewindow: Timewindow;

  timewindowForm: UntypedFormGroup;

  historyTypes = HistoryWindowType;

  realtimeTypes = RealtimeWindowType;

  timewindowTypes = TimewindowType;

  aggregationTypes = AggregationType;

  result: Timewindow;

  timewindowTypeOptions: ToggleHeaderOption[] = [{
    name: this.translate.instant('timewindow.history'),
    value: this.timewindowTypes.HISTORY
  }];

  realtimeTimewindowOptions: ToggleHeaderOption[] = [];

  historyTimewindowOptions: ToggleHeaderOption[] = [];

  realtimeTypeSelectionAvailable: boolean;
  realtimeIntervalSelectionAvailable: boolean;
  historyTypeSelectionAvailable: boolean;
  historyIntervalSelectionAvailable: boolean;
  aggregationOptionsAvailable: boolean;

  allowedAggTypes: Array<AggregationType>;

  private destroy$ = new Subject<void>();

  constructor(@Inject(TIMEWINDOW_PANEL_DATA) public data: TimewindowPanelData,
              public overlayRef: OverlayRef,
              protected store: Store<AppState>,
              public fb: UntypedFormBuilder,
              private timeService: TimeService,
              private translate: TranslateService,
              public viewContainerRef: ViewContainerRef,
              private dialog: MatDialog) {
    super(store);
    this.historyOnly = data.historyOnly;
    this.forAllTimeEnabled = data.forAllTimeEnabled;
    this.quickIntervalOnly = data.quickIntervalOnly;
    this.timewindow = data.timewindow;
    this.aggregation = data.aggregation;
    this.timezone = data.timezone;
    this.isEdit = data.isEdit;

    this.allowedAggTypes = this.timewindow.allowedAggTypes;

    if (!this.historyOnly) {
      this.timewindowTypeOptions.unshift({
        name: this.translate.instant('timewindow.realtime'),
        value: this.timewindowTypes.REALTIME
      });
    }

    if ((this.isEdit || !this.timewindow.realtime.hideLastInterval) && !this.quickIntervalOnly) {
      this.realtimeTimewindowOptions.push({
        name: this.translate.instant(realtimeWindowTypeTranslations.get(RealtimeWindowType.LAST_INTERVAL)),
        value: this.realtimeTypes.LAST_INTERVAL
      });
    }

    if (this.isEdit || !this.timewindow.realtime.hideQuickInterval || this.quickIntervalOnly) {
      this.realtimeTimewindowOptions.push({
        name: this.translate.instant(realtimeWindowTypeTranslations.get(RealtimeWindowType.INTERVAL)),
        value: this.realtimeTypes.INTERVAL
      });
    }

    if (this.forAllTimeEnabled) {
      this.historyTimewindowOptions.push({
        name: this.translate.instant(historyWindowTypeTranslations.get(HistoryWindowType.FOR_ALL_TIME)),
        value: this.historyTypes.FOR_ALL_TIME
      });
    }

    if (this.isEdit || !this.timewindow.history.hideLastInterval) {
      this.historyTimewindowOptions.push({
        name: this.translate.instant(historyWindowTypeTranslations.get(HistoryWindowType.LAST_INTERVAL)),
        value: this.historyTypes.LAST_INTERVAL
      });
    }

    if (this.isEdit || !this.timewindow.history.hideFixedInterval) {
      this.historyTimewindowOptions.push({
        name: this.translate.instant(historyWindowTypeTranslations.get(HistoryWindowType.FIXED)),
        value: this.historyTypes.FIXED
      });
    }

    if (this.isEdit || !this.timewindow.history.hideQuickInterval) {
      this.historyTimewindowOptions.push({
        name: this.translate.instant(historyWindowTypeTranslations.get(HistoryWindowType.INTERVAL)),
        value: this.historyTypes.INTERVAL
      });
    }

    this.realtimeTypeSelectionAvailable = this.realtimeTimewindowOptions.length > 1;
    this.historyTypeSelectionAvailable = this.historyTimewindowOptions.length > 1;
    this.realtimeIntervalSelectionAvailable = this.isEdit || !(this.timewindow.realtime.hideInterval ||
      (this.timewindow.realtime.hideLastInterval && this.timewindow.realtime.hideQuickInterval));
    this.historyIntervalSelectionAvailable = this.isEdit || !(this.timewindow.history.hideInterval ||
      (this.timewindow.history.hideLastInterval && this.timewindow.history.hideQuickInterval && this.timewindow.history.hideFixedInterval));

    this.aggregationOptionsAvailable = this.aggregation && (this.isEdit ||
      !(this.timewindow.hideAggregation && this.timewindow.hideAggInterval));
  }

  ngOnInit(): void {
    const hideAggregation = this.timewindow.hideAggregation || false;
    const hideAggInterval = this.timewindow.hideAggInterval || false;
    const hideTimezone = this.timewindow.hideTimezone || false;

    const realtime = this.timewindow.realtime;
    const history = this.timewindow.history;
    const aggregation = this.timewindow.aggregation;

    if (!this.isEdit) {
      if (realtime.hideLastInterval && !realtime.hideQuickInterval) {
        realtime.realtimeType = RealtimeWindowType.INTERVAL;
      }
      if (realtime.hideQuickInterval && !realtime.hideLastInterval) {
        realtime.realtimeType = RealtimeWindowType.LAST_INTERVAL;
      }

      if (history.hideLastInterval) {
        if (!history.hideFixedInterval) {
          history.historyType = HistoryWindowType.FIXED;
        } else if (!history.hideQuickInterval) {
          history.historyType = HistoryWindowType.INTERVAL;
        }
      }
      if (history.hideFixedInterval) {
        if (!history.hideLastInterval) {
          history.historyType = HistoryWindowType.LAST_INTERVAL;
        } else if (!history.hideQuickInterval) {
          history.historyType = HistoryWindowType.INTERVAL;
        }
      }
      if (history.hideQuickInterval) {
        if (!history.hideLastInterval) {
          history.historyType = HistoryWindowType.LAST_INTERVAL;
        } else if (!history.hideFixedInterval) {
          history.historyType = HistoryWindowType.FIXED;
        }
      }
    }

    this.timewindowForm = this.fb.group({
      selectedTab: [isDefined(this.timewindow.selectedTab) ? this.timewindow.selectedTab : TimewindowType.REALTIME],
      realtime: this.fb.group({
        realtimeType: [{
          value: isDefined(realtime?.realtimeType) ? realtime.realtimeType : RealtimeWindowType.LAST_INTERVAL,
          disabled: realtime.hideInterval
        }],
        timewindowMs: [{
          value: isDefined(realtime?.timewindowMs) ? realtime.timewindowMs : null,
          disabled: realtime.hideInterval || realtime.hideLastInterval
        }],
        interval: [{
          value:isDefined(realtime?.interval) ? realtime.interval : null,
          disabled: hideAggInterval
        }],
        quickInterval: [{
          value: isDefined(realtime?.quickInterval) ? realtime.quickInterval : null,
          disabled: realtime.hideInterval || realtime.hideQuickInterval
        }]
      }),
      history: this.fb.group({
        historyType: [{
          value: isDefined(history?.historyType) ? history.historyType : HistoryWindowType.LAST_INTERVAL,
          disabled: history.hideInterval
        }],
        timewindowMs: [{
          value: isDefined(history?.timewindowMs) ? history.timewindowMs : null,
          disabled: history.hideInterval || history.hideLastInterval
        }],
        interval: [{
          value:isDefined(history?.interval) ? history.interval : null,
          disabled: hideAggInterval
        }],
        fixedTimewindow: [{
          value: isDefined(history?.fixedTimewindow) ? history.fixedTimewindow : null,
          disabled: history.hideInterval || history.hideFixedInterval
        }],
        quickInterval: [{
          value: isDefined(history?.quickInterval) ? history.quickInterval : null,
          disabled: history.hideInterval || history.hideQuickInterval
        }]
      }),
      aggregation: this.fb.group({
        type: [{
          value: isDefined(aggregation?.type) ? aggregation.type : null,
          disabled: hideAggregation
        }],
        limit: [{
          value: isDefined(aggregation?.limit) ? aggregation.limit : null,
          disabled: hideAggInterval
        }, []]
      }),
      timezone: [{
        value: isDefined(this.timewindow.timezone) ? this.timewindow.timezone : null,
        disabled: hideTimezone
      }]
    });
    this.updateValidators(this.timewindowForm.get('aggregation.type').value);
    this.timewindowForm.get('aggregation.type').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe((aggregationType: AggregationType) => {
      this.updateValidators(aggregationType);
    });

    this.timewindowForm.get('selectedTab').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe((selectedTab: TimewindowType) => {
      this.onTimewindowTypeChange(selectedTab);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateValidators(aggType: AggregationType) {
    if (aggType !== AggregationType.NONE) {
      this.timewindowForm.get('aggregation.limit').clearValidators();
    } else {
      this.timewindowForm.get('aggregation.limit').setValidators([Validators.required]);
    }
    this.timewindowForm.get('aggregation.limit').updateValueAndValidity({emitEvent: false});
  }

  private onTimewindowTypeChange(selectedTab: TimewindowType) {
    const timewindowFormValue = this.timewindowForm.getRawValue();
    if (selectedTab === TimewindowType.REALTIME) {
      if (timewindowFormValue.history.historyType !== HistoryWindowType.FIXED
        && !((this.quickIntervalOnly || this.timewindow.realtime.hideLastInterval)
          && timewindowFormValue.history.historyType === HistoryWindowType.LAST_INTERVAL)
        && !(this.timewindow.realtime.hideQuickInterval && timewindowFormValue.history.historyType === HistoryWindowType.INTERVAL)) {

        this.timewindowForm.get('realtime').patchValue({
          realtimeType: Object.keys(RealtimeWindowType).includes(HistoryWindowType[timewindowFormValue.history.historyType]) ?
            RealtimeWindowType[HistoryWindowType[timewindowFormValue.history.historyType]] :
            timewindowFormValue.realtime.realtimeType,
          timewindowMs: timewindowFormValue.history.timewindowMs,
          quickInterval: timewindowFormValue.history.quickInterval.startsWith('CURRENT') ?
            timewindowFormValue.history.quickInterval : timewindowFormValue.realtime.quickInterval
        });
        setTimeout(() => this.timewindowForm.get('realtime.interval').patchValue(timewindowFormValue.history.interval));
      }
    } else if (!(this.timewindow.history.hideLastInterval && timewindowFormValue.realtime.realtimeType === RealtimeWindowType.LAST_INTERVAL)
      && !(this.timewindow.history.hideQuickInterval && timewindowFormValue.realtime.realtimeType === RealtimeWindowType.INTERVAL)) {

      this.timewindowForm.get('history').patchValue({
        historyType: HistoryWindowType[RealtimeWindowType[timewindowFormValue.realtime.realtimeType]],
        timewindowMs: timewindowFormValue.realtime.timewindowMs,
        quickInterval: timewindowFormValue.realtime.quickInterval
      });
      setTimeout(() => this.timewindowForm.get('history.interval').patchValue(timewindowFormValue.realtime.interval));
    }
    this.timewindowForm.patchValue({
      aggregation: {
        type: timewindowFormValue.aggregation.type,
        limit: timewindowFormValue.aggregation.limit
      },
      timezone: timewindowFormValue.timezone
    });
  }

  update() {
    this.prepareTimewindowConfig();
    this.result = this.timewindow;
    this.overlayRef.dispose();
  }

  private prepareTimewindowConfig() {
    const timewindowFormValue = this.timewindowForm.getRawValue();
    this.timewindow.selectedTab = timewindowFormValue.selectedTab;
    this.timewindow.realtime = {...this.timewindow.realtime, ...{
        realtimeType: timewindowFormValue.realtime.realtimeType,
        timewindowMs: timewindowFormValue.realtime.timewindowMs,
        quickInterval: timewindowFormValue.realtime.quickInterval,
        interval: timewindowFormValue.realtime.interval
      }};
    this.timewindow.history = {...this.timewindow.history, ...{
        historyType: timewindowFormValue.history.historyType,
        timewindowMs: timewindowFormValue.history.timewindowMs,
        interval: timewindowFormValue.history.interval,
        fixedTimewindow: timewindowFormValue.history.fixedTimewindow,
        quickInterval: timewindowFormValue.history.quickInterval,
      }};
    if (!this.timewindow.allowedAggTypes?.length) {
      delete this.timewindow.allowedAggTypes;
    }
    if (this.aggregation) {
      this.timewindow.aggregation = {
        type: timewindowFormValue.aggregation.type,
        limit: timewindowFormValue.aggregation.limit
      };
    }
    if (this.timezone) {
      this.timewindow.timezone = timewindowFormValue.timezone;
    }
  }

  private updateTimewindowForm() {
    this.timewindowForm.patchValue(this.timewindow);

    if (this.timewindow.realtime.hideInterval) {
      this.timewindowForm.get('realtime.realtimeType').disable({emitEvent: false});
      this.timewindowForm.get('realtime.timewindowMs').disable({emitEvent: false});
      this.timewindowForm.get('realtime.quickInterval').disable({emitEvent: false});
    } else {
      this.timewindowForm.get('realtime.realtimeType').enable({emitEvent: false});
      if (this.timewindow.realtime.hideLastInterval) {
        this.timewindowForm.get('realtime.timewindowMs').disable({emitEvent: false});
      } else {
        this.timewindowForm.get('realtime.timewindowMs').enable({emitEvent: false});
      }
      if (this.timewindow.realtime.hideQuickInterval) {
        this.timewindowForm.get('realtime.quickInterval').disable({emitEvent: false});
      } else {
        this.timewindowForm.get('realtime.quickInterval').enable({emitEvent: false});
      }
    }

    if (this.timewindow.history.hideInterval) {
      this.timewindowForm.get('history.historyType').disable({emitEvent: false});
      this.timewindowForm.get('history.timewindowMs').disable({emitEvent: false});
      this.timewindowForm.get('history.fixedTimewindow').disable({emitEvent: false});
      this.timewindowForm.get('history.quickInterval').disable({emitEvent: false});
    } else {
      this.timewindowForm.get('history.historyType').enable({emitEvent: false});
      if (this.timewindow.history.hideLastInterval) {
        this.timewindowForm.get('history.timewindowMs').disable({emitEvent: false});
      } else {
        this.timewindowForm.get('history.timewindowMs').enable({emitEvent: false});
      }
      if (this.timewindow.history.hideFixedInterval) {
        this.timewindowForm.get('history.fixedTimewindow').disable({emitEvent: false});
      } else {
        this.timewindowForm.get('history.fixedTimewindow').enable({emitEvent: false});
      }
      if (this.timewindow.history.hideQuickInterval) {
        this.timewindowForm.get('history.quickInterval').disable({emitEvent: false});
      } else {
        this.timewindowForm.get('history.quickInterval').enable({emitEvent: false});
      }
    }

    if (this.timewindow.hideAggregation) {
      this.timewindowForm.get('aggregation.type').disable({emitEvent: false});
    } else {
      this.timewindowForm.get('aggregation.type').enable({emitEvent: false});
    }
    if (this.timewindow.hideAggInterval) {
      this.timewindowForm.get('aggregation.limit').disable({emitEvent: false});
      this.timewindowForm.get('realtime.interval').disable({emitEvent: false});
      this.timewindowForm.get('history.interval').disable({emitEvent: false});
    } else {
      this.timewindowForm.get('aggregation.limit').enable({emitEvent: false});
      this.timewindowForm.get('realtime.interval').enable({emitEvent: false});
      this.timewindowForm.get('history.interval').enable({emitEvent: false});
    }

    if (this.timewindow.hideTimezone) {
      this.timewindowForm.get('timezone').disable({emitEvent: false});
    } else {
      this.timewindowForm.get('timezone').enable({emitEvent: false});
    }

    this.timewindowForm.markAsDirty();
  }

  cancel() {
    this.overlayRef.dispose();
  }

  minRealtimeAggInterval() {
    return this.timeService.minIntervalLimit(this.currentRealtimeTimewindow());
  }

  maxRealtimeAggInterval() {
    return this.timeService.maxIntervalLimit(this.currentRealtimeTimewindow());
  }

  currentRealtimeTimewindow(): number {
    const timeWindowFormValue = this.timewindowForm.getRawValue();
    switch (timeWindowFormValue.realtime.realtimeType) {
      case RealtimeWindowType.LAST_INTERVAL:
        return timeWindowFormValue.realtime.timewindowMs;
      case RealtimeWindowType.INTERVAL:
        return quickTimeIntervalPeriod(timeWindowFormValue.realtime.quickInterval);
      default:
        return DAY;
    }
  }

  minHistoryAggInterval() {
    return this.timeService.minIntervalLimit(this.currentHistoryTimewindow());
  }

  maxHistoryAggInterval() {
    return this.timeService.maxIntervalLimit(this.currentHistoryTimewindow());
  }

  currentHistoryTimewindow() {
    const timewindowFormValue = this.timewindowForm.getRawValue();
    if (timewindowFormValue.history.historyType === HistoryWindowType.LAST_INTERVAL) {
      return timewindowFormValue.history.timewindowMs;
    } else if (timewindowFormValue.history.historyType === HistoryWindowType.INTERVAL) {
      return quickTimeIntervalPeriod(timewindowFormValue.history.quickInterval);
    } else if (timewindowFormValue.history.fixedTimewindow) {
      return timewindowFormValue.history.fixedTimewindow.endTimeMs -
        timewindowFormValue.history.fixedTimewindow.startTimeMs;
    } else {
      return DAY;
    }
  }

  openTimewindowConfig() {
    this.prepareTimewindowConfig();
    this.dialog.open<TimewindowConfigDialogComponent, TimewindowConfigDialogData, Timewindow>(
      TimewindowConfigDialogComponent, {
        autoFocus: false,
        disableClose: true,
        panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
        data: {
          quickIntervalOnly: this.quickIntervalOnly,
          aggregation: this.aggregation,
          timewindow: deepClone(this.timewindow)
        }
      }).afterClosed()
      .subscribe((res) => {
        if (res) {
          this.timewindow = res;
          this.allowedAggTypes = this.timewindow.allowedAggTypes;
          this.updateTimewindowForm();
        }
      });
  }

  protected readonly AggregationType = AggregationType;
}
